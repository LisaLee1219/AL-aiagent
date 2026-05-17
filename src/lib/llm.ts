/**
 * OpenAI-compatible chat completions (works with OpenAI, DeepSeek, Ollama, Azure, etc.)
 *
 * Configure via .env.local:
 *   OPENAI_API_KEY=sk-...
 *   OPENAI_BASE_URL=https://api.openai.com/v1   (optional)
 *   OPENAI_MODEL=gpt-4o-mini                     (optional)
 */

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface InvokeOptions {
  model?: string;
  temperature?: number;
}

export interface InvokeResult {
  content: string;
}

const PLACEHOLDER_KEY_MARKERS = [
  'your-key-here',
  'sk-your',
  'change-me',
  'xxx',
  'placeholder',
];

function getApiKey(): string | undefined {
  const key =
    process.env.OPENAI_API_KEY?.trim() || process.env.AI_API_KEY?.trim();
  if (!key) return undefined;
  const lower = key.toLowerCase();
  if (PLACEHOLDER_KEY_MARKERS.some((m) => lower.includes(m))) return undefined;
  return key;
}

function getBaseUrl(): string {
  const url = process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1';
  return url.replace(/\/$/, '');
}

function getModel(override?: string): string {
  return override || process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
}

export function isAIConfigured(): boolean {
  return !!getApiKey();
}

export function assertAIConfigured(): void {
  if (!isAIConfigured()) {
    throw new Error(
      'AI 未配置：请在项目根目录 .env.local 中设置有效的 OPENAI_API_KEY（可参考 .env.example）。',
    );
  }
}

export async function invokeChat(
  messages: ChatMessage[],
  options: InvokeOptions = {},
): Promise<InvokeResult> {
  assertAIConfigured();

  const res = await fetch(`${getBaseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: getModel(options.model),
      messages,
      temperature: options.temperature ?? 0.7,
      stream: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 401) {
      throw new Error(
        'AI API 密钥无效或未授权，请检查 .env.local 中的 OPENAI_API_KEY 是否正确。',
      );
    }
    if (res.status === 402 || err.includes('Insufficient Balance')) {
      throw new Error(
        'DeepSeek 账户余额不足：请登录 https://platform.deepseek.com 充值后再试。',
      );
    }
    throw new Error(`AI 请求失败 (${res.status}): ${err.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? '';
  return { content: typeof content === 'string' ? content : String(content) };
}

export async function* streamChat(
  messages: ChatMessage[],
  options: InvokeOptions = {},
): AsyncGenerator<{ content: string }> {
  assertAIConfigured();

  const res = await fetch(`${getBaseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: getModel(options.model),
      messages,
      temperature: options.temperature ?? 0.7,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 402 || err.includes('Insufficient Balance')) {
      throw new Error(
        'DeepSeek 账户余额不足：请登录 https://platform.deepseek.com 充值后再试。',
      );
    }
    throw new Error(`LLM stream failed (${res.status}): ${err.slice(0, 500)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('LLM stream returned no body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield { content: delta };
      } catch {
        // ignore malformed SSE chunks
      }
    }
  }
}

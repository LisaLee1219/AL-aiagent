/**
 * Multi-Agent Chat API
 *
 * POST /api/agent/chat
 */

import { NextRequest } from 'next/server';
import { invokeChat, streamChat, type ChatMessage } from '@/lib/llm';
import { ensureEnvLoaded } from '@/lib/env-loader';
import {
  AgentType,
  AGENT_CONFIG,
  TOOL_USAGE_PROMPT,
} from '@/lib/agent-config';
import {
  parseToolCalls,
  stripToolCalls,
  executeAllToolCalls,
  formatToolResults,
} from '@/lib/agent-tools';

export const dynamic = 'force-dynamic';

interface ChatRequestMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatRequestMessage[];
  agent: AgentType;
  stream?: boolean;
}

export async function POST(request: NextRequest) {
  await ensureEnvLoaded();
  try {
    const body = (await request.json()) as ChatRequest;
    const { messages, agent = 'master', stream = true } = body;

    if (!messages || messages.length === 0) {
      return Response.json({ error: 'Messages are required' }, { status: 400 });
    }

    const config = AGENT_CONFIG[agent];
    if (!config) {
      return Response.json({ error: `Unknown agent: ${agent}` }, { status: 400 });
    }

    const systemPrompt = config.systemPrompt + TOOL_USAGE_PROMPT;

    const llmMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    if (stream) {
      return handleStreaming(llmMessages, agent);
    }
    return handleNonStreaming(llmMessages, agent);
  } catch (error) {
    console.error('[Agent Chat API Error]', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
}

async function handleStreaming(messages: ChatMessage[], agent: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send('meta', { agent, phase: 'thinking' });

        let fullText = '';
        for await (const chunk of streamChat(messages)) {
          if (chunk.content) {
            fullText += chunk.content;
            const toolCalls = parseToolCalls(fullText);
            if (toolCalls.length === 0) {
              send('delta', { content: chunk.content });
            }
          }
        }

        const toolCalls = parseToolCalls(fullText);
        if (toolCalls.length > 0) {
          send('meta', { agent, phase: 'executing_tools', tools: toolCalls.map((t) => t.tool) });

          const results = await executeAllToolCalls(fullText);
          const toolContext = formatToolResults(results);

          send('tool_results', {
            tools: results.map((r) => ({ tool: r.tool, success: r.success })),
          });

          send('meta', { agent, phase: 'analysing' });

          const followUpMessages: ChatMessage[] = [
            ...messages,
            { role: 'assistant', content: stripToolCalls(fullText) },
            { role: 'user', content: toolContext },
          ];

          for await (const chunk of streamChat(followUpMessages)) {
            if (chunk.content) {
              send('delta', { content: chunk.content });
            }
          }
        }

        send('done', { agent });
      } catch (error) {
        send('error', { message: String(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

async function handleNonStreaming(messages: ChatMessage[], agent: string) {
  const firstResponse = await invokeChat(messages);
  let fullText = firstResponse.content || '';

  const toolCalls = parseToolCalls(fullText);
  let toolResults: unknown[] = [];

  if (toolCalls.length > 0) {
    const results = await executeAllToolCalls(fullText);
    toolResults = results;

    const toolContext = formatToolResults(results);
    const followUpMessages: ChatMessage[] = [
      ...messages,
      { role: 'assistant', content: stripToolCalls(fullText) },
      { role: 'user', content: toolContext },
    ];

    const followUpResponse = await invokeChat(followUpMessages);
    fullText = followUpResponse.content || fullText;
  }

  return Response.json({
    success: true,
    agent,
    content: stripToolCalls(fullText),
    toolCalls: toolCalls.map((t) => t.tool),
    toolResults,
  });
}

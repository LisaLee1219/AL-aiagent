import type { ChatMessage } from '@/lib/llm';
import { AGENT_GROUNDING_PROMPT } from '@/lib/agent-grounding';
import { prefetchDataForUserMessage } from '@/lib/agent-prefetch';
import { buildAgentSystemContext } from '@/lib/agent-system-context';
import {
  AgentType,
  AGENT_CONFIG,
  TOOL_USAGE_PROMPT,
} from '@/lib/agent-config';

export interface ChatRequestMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PreparedAgentChat {
  messages: ChatMessage[];
  agent: AgentType;
  prefetchTools: string[];
}

/**
 * Build system prompt + optional pre-fetched live data for the latest user turn.
 */
export async function prepareAgentChatMessages(
  messages: ChatRequestMessage[],
  agent: AgentType = 'master',
): Promise<PreparedAgentChat> {
  const config = AGENT_CONFIG[agent];
  if (!config) {
    throw new Error(`Unknown agent: ${agent}`);
  }

  const systemContext = await buildAgentSystemContext();
  const systemPrompt =
    config.systemPrompt + TOOL_USAGE_PROMPT + AGENT_GROUNDING_PROMPT + '\n\n' + systemContext;

  const lastUserIndex = [...messages].map((m, i) => ({ m, i })).reverse().find((x) => x.m.role === 'user')?.i;
  const lastUser = lastUserIndex !== undefined ? messages[lastUserIndex] : null;

  let prefetchTools: string[] = [];
  let augmentedLastUser = lastUser?.content ?? '';

  if (lastUser?.content) {
    const prefetch = await prefetchDataForUserMessage(lastUser.content);
    prefetchTools = prefetch.tools;
    if (prefetch.context) {
      augmentedLastUser = `${lastUser.content}\n${prefetch.context}`;
    }
  }

  const history: ChatMessage[] = messages.map((m, i) => {
    if (lastUserIndex !== undefined && i === lastUserIndex) {
      return { role: 'user' as const, content: augmentedLastUser };
    }
    return { role: m.role, content: m.content };
  });

  return {
    messages: [{ role: 'system', content: systemPrompt }, ...history],
    agent,
    prefetchTools,
  };
}

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AGENT_CONFIG, type AgentType } from '@/lib/agent-config';
import { AgentMessageContent } from '@/components/agent-message-content';
import {
  Bot,
  Send,
  Loader2,
  Wrench,
  ChevronDown,
  X,
  User,
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
  toolCalls?: string[];
  phase?: string;
}

interface AgentChatProps {
  /** Which agent to chat with. Default: 'master' */
  defaultAgent?: AgentType;
  /** Whether to show agent selector. Default: true */
  showAgentSelector?: boolean;
  /** Compact mode for embedding in department pages */
  compact?: boolean;
  /** Initial prompt to pre-fill */
  initialPrompt?: string;
  /** Title override */
  title?: string;
}

export function AgentChat({
  defaultAgent = 'master',
  showAgentSelector = true,
  compact = false,
  initialPrompt = '',
  title,
}: AgentChatProps) {
  const [selectedAgent, setSelectedAgent] = useState<AgentType>(defaultAgent);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialPrompt);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);
    setCurrentPhase('thinking');

    const assistantMessage: Message = {
      role: 'assistant',
      content: '',
      agent: selectedAgent,
    };
    setMessages([...newMessages, assistantMessage]);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          agent: selectedAgent,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const event = line.slice(7).trim();
            // Next line will be data
            continue;
          }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.phase === 'loading_data') {
                setCurrentPhase('Loading live system data...');
                setActiveTools(data.tools || []);
              } else if (data.phase === 'thinking') {
                setCurrentPhase('Thinking...');
              } else if (data.phase === 'executing_tools') {
                setCurrentPhase('Fetching data...');
                setActiveTools(data.tools || []);
              } else if (data.phase === 'analysing') {
                setCurrentPhase('Analysing...');
                setActiveTools([]);
              }

              if (data.content) {
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + data.content,
                    };
                  }
                  return updated;
                });
              }

              if (data.tools) {
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      toolCalls: data.tools.map((t: { tool: string }) => t.tool),
                    };
                  }
                  return updated;
                });
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === 'assistant') {
            updated[updated.length - 1] = {
              ...last,
              content: 'Sorry, an error occurred. Please try again.',
            };
          }
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      setCurrentPhase('');
      setActiveTools([]);
      abortRef.current = null;
    }
  }, [input, messages, isStreaming, selectedAgent]);

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const config = AGENT_CONFIG[selectedAgent];

  return (
    <Card className={compact ? 'border-0 shadow-none' : 'h-full flex flex-col shadow-none'}>
      {/* Header */}
      <CardHeader className={`${compact ? 'px-3 py-2' : 'px-4 py-3'} border-b flex-shrink-0`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className={`${compact ? 'text-sm' : 'text-base'} font-medium`}>
              {title || config.label}
            </CardTitle>
            {isStreaming && (
              <Badge variant="outline" className="text-xs animate-pulse">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                {currentPhase || 'Processing'}
              </Badge>
            )}
            {activeTools.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Wrench className="h-3 w-3 mr-1" />
                {activeTools.join(', ')}
              </Badge>
            )}
          </div>

          {showAgentSelector && (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => setShowAgentMenu(!showAgentMenu)}
              >
                {config.icon} {config.label}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
              {showAgentMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border rounded-lg shadow-lg z-50">
                  {(Object.entries(AGENT_CONFIG) as [AgentType, typeof AGENT_CONFIG[AgentType]][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                        key === selectedAgent ? 'bg-gray-100' : ''
                      }`}
                      onClick={() => {
                        setSelectedAgent(key);
                        setShowAgentMenu(false);
                      }}
                    >
                      <span>{cfg.icon}</span>
                      <span>{cfg.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      {/* Messages */}
      <ScrollArea className={`flex-1 ${compact ? 'h-64' : 'min-h-0'}`}>
        <div className={`${compact ? 'p-3' : 'p-4'} space-y-4`} ref={scrollRef}>
          {messages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                Chat with the {config.label}
              </p>
              <p className="text-xs mt-1">
                {selectedAgent === 'master'
                  ? 'I can route tasks across departments and coordinate workflows'
                  : `I specialise in ${config.label.toLowerCase()} tasks`}
              </p>
              {selectedAgent === 'master' && (
                <div className="flex flex-wrap gap-1.5 justify-center mt-4 max-w-md mx-auto">
                  {[
                    'Parse this customer email and find matching products',
                    'What are our top-selling product categories?',
                    'Generate a sales report for this month',
                    'Check inventory for low stock items',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="text-xs px-3 py-1.5 rounded-md border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors text-left"
                      onClick={() => setInput(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const agentCfg =
              msg.agent && msg.agent in AGENT_CONFIG
                ? AGENT_CONFIG[msg.agent as AgentType]
                : config;

            return (
            <div
              key={i}
              className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                  isUser ? 'bg-muted' : 'bg-muted/40'
                }`}
              >
                {isUser ? (
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <div className={`min-w-0 max-w-[min(100%,42rem)] ${isUser ? 'flex flex-col items-end' : ''}`}>
                {!isUser && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5 px-0.5">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {agentCfg.label}
                    </span>
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                        <Wrench className="h-2.5 w-2.5 mr-0.5" />
                        {msg.toolCalls.join(', ')}
                      </Badge>
                    )}
                  </div>
                )}
              <div
                className={
                  isUser
                    ? 'rounded-lg bg-muted px-3.5 py-2.5 text-foreground'
                    : 'rounded-lg border bg-background px-3.5 py-3'
                }
              >
                {msg.role === 'user' ? (
                  <p className={`leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>{msg.content}</p>
                ) : msg.content ? (
                  <AgentMessageContent
                    content={msg.content}
                    isStreaming={i === messages.length - 1 && isStreaming}
                  />
                ) : (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    {currentPhase || 'Thinking...'}
                  </span>
                )}
              </div>
              </div>
            </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className={`${compact ? 'px-3 py-2' : 'px-4 py-3'} border-t flex-shrink-0`}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask the ${config.label}...`}
            className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button size="sm" variant="destructive" onClick={handleStop}>
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={sendMessage} disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

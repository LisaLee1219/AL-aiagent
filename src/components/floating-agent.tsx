'use client';

import { useState } from 'react';
import { AgentChat } from '@/components/agent-chat';
import type { AgentType } from '@/lib/agent-config';
import { Bot, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FloatingAgentProps {
  agent: AgentType;
}

export function FloatingAgent({ agent }: FloatingAgentProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg transition-all duration-300 ${
          isOpen
            ? 'bg-destructive hover:bg-destructive/90 rotate-0'
            : 'bg-gradient-to-br from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700'
        }`}
        size="icon"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </Button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-96 h-[500px] shadow-xl rounded-xl border overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          <AgentChat defaultAgent={agent} compact showAgentSelector={false} />
        </div>
      )}
    </>
  );
}

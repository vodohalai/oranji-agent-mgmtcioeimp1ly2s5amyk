import React, { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import { ChatWindow } from '@/components/ChatWindow';
import { chatService, generateSessionTitle } from '@/lib/chat';
import type { ChatState } from '../../worker/types';
export function ChatEmbed(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    sessionId: chatService.getSessionId(),
    isProcessing: false,
    model: 'google-ai-studio/gemini-2.5-flash',
    streamingMessage: ''
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const loadCurrentSession = useCallback(async () => {
    const response = await chatService.getMessages();
    if (response.success && response.data) {
      setChatState(prev => ({ ...prev, ...response.data }));
    }
  }, []);
  useEffect(() => {
    if (isOpen) {
      loadCurrentSession();
    }
  }, [isOpen, loadCurrentSession]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const message = input.trim();
    setInput('');
    setIsLoading(true);
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: message,
      timestamp: Date.now()
    };
    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      streamingMessage: ''
    }));
    if (chatState.messages.length === 0) {
      const title = generateSessionTitle(message);
      await chatService.createSession(title, chatState.sessionId, message);
    }
    await chatService.sendMessage(message, chatState.model, (chunk) => {
      setChatState(prev => ({
        ...prev,
        streamingMessage: (prev.streamingMessage || '') + chunk
      }));
    });
    await loadCurrentSession();
    setIsLoading(false);
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  return (
    <div className="fixed bottom-5 right-5 z-50">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button size="lg" className="rounded-full w-16 h-16 shadow-lg btn-gradient">
            <MessageSquare className="w-8 h-8" />
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Oranji AI Assistant</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0">
            <ChatWindow
              chatState={chatState}
              input={input}
              isLoading={isLoading}
              onInputChange={(e) => setInput(e.target.value)}
              onSendMessage={handleSubmit}
              onKeyDown={handleKeyDown}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, User, Clock, Wrench, Send, Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatTime, renderToolCall } from '@/lib/chat';
import type { ChatState } from '../../worker/types';
import { cn } from '@/lib/utils';
interface ChatWindowProps {
  chatState: ChatState;
  input: string;
  isLoading: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSendMessage: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}
export function ChatWindow({
  chatState,
  input,
  isLoading,
  onInputChange,
  onSendMessage,
  onKeyDown,
}: ChatWindowProps): JSX.Element {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [chatState.messages, chatState.streamingMessage]);
  return (
    <Card className="h-full w-full flex flex-col bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl">
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="p-4 sm:p-6 space-y-6">
            {chatState.messages.length === 0 && !isLoading && (
              <div className="text-center text-muted-foreground py-8 flex flex-col items-center justify-center h-full animate-fade-in">
                <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-semibold">Bắt đầu cuộc trò chuyện</p>
                <p className="text-sm">Hỏi tôi bất cứ điều gì hoặc thử một trong các gợi ý sau:</p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <Badge variant="secondary">Thông tin sản phẩm mới nhất</Badge>
                  <Badge variant="secondary">Tra cứu tài liệu về "Oranji API"</Badge>
                  <Badge variant="secondary">Tóm tắt lịch sử trò chuyện</Badge>
                </div>
              </div>
            )}
            {chatState.messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={cn('flex items-end gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {msg.role === 'assistant' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-primary center text-primary-foreground"><Bot size={18} /></div>}
                <div className={cn('max-w-[85%] p-3 rounded-2xl', msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-lg' : 'bg-muted rounded-bl-lg')}>
                  <p className="whitespace-pre-wrap text-pretty">{msg.content}</p>
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-current/20">
                      <div className="flex items-center gap-1.5 mb-2 text-xs opacity-80">
                        <Wrench size={14} />
                        <span>Công c��� đã sử dụng:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.toolCalls.map((tool, idx) => (
                          <Badge key={idx} variant={msg.role === 'user' ? 'secondary' : 'outline'} className="text-xs font-normal">
                            {renderToolCall(tool)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-right text-xs opacity-60 mt-2">{formatTime(msg.timestamp)}</div>
                </div>
                {msg.role === 'user' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary center text-secondary-foreground"><User size={18} /></div>}
              </motion.div>
            ))}
            {chatState.streamingMessage && (
              <div className="flex items-end gap-2 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-primary center text-primary-foreground"><Bot size={18} /></div>
                <div className="bg-muted p-3 rounded-2xl rounded-bl-lg max-w-[85%]">
                  <p className="whitespace-pre-wrap text-pretty">{chatState.streamingMessage}<span className="animate-pulse">▍</span></p>
                </div>
              </div>
            )}
            {(isLoading || chatState.isProcessing) && !chatState.streamingMessage && (
              <div className="flex items-end gap-2 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-primary center text-primary-foreground"><Bot size={18} /></div>
                <div className="bg-muted p-3 rounded-2xl rounded-bl-lg">
                  <div className="flex space-x-1.5">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: `${i * 150}ms`, animationDuration: '1s' }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-2 border-t">
        <form onSubmit={onSendMessage} className="flex gap-2 items-end w-full">
          <Textarea
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            placeholder="Nhập tin nhắn của bạn..."
            className="flex-1 min-h-[44px] max-h-48 resize-none leading-tight py-3 bg-secondary border-input focus-visible:ring-1 focus-visible:ring-offset-0"
            rows={1}
            disabled={isLoading || chatState.isProcessing}
            aria-label="Chat input"
          />
          <Button
            type="submit"
            size="icon"
            className="w-11 h-11 flex-shrink-0 btn-gradient"
            disabled={!input.trim() || isLoading || chatState.isProcessing}
            aria-label="Send message"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
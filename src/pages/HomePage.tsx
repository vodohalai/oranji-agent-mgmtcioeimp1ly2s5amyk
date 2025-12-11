import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bot, Plus, Trash2, Settings, Menu, X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { chatService, MODELS } from '@/lib/chat';
import type { ChatState, SessionInfo } from '../../worker/types';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ChatWindow } from '@/components/ChatWindow';
import { Toaster, toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
export function HomePage() {
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    sessionId: chatService.getSessionId(),
    isProcessing: false,
    model: MODELS[0].id,
    streamingMessage: ''
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const handleNewSession = useCallback(() => {
    chatService.newSession();
    setChatState(prev => ({
      ...prev,
      messages: [],
      sessionId: 'new',
      isProcessing: false,
      streamingMessage: ''
    }));
    setIsSidebarOpen(false);
  }, []);
  const loadCurrentSession = useCallback(async (sessionId: string) => {
    if (!sessionId || sessionId === 'new') {
      setChatState(prev => ({
        ...prev,
        messages: [],
        sessionId: 'new',
        isProcessing: false,
        streamingMessage: ''
      }));
      return;
    }
    chatService.switchSession(sessionId);
    const response = await chatService.getMessages();
    if (response.success && response.data) {
      setChatState(response.data);
    } else {
      toast.error("Không thể t���i phiên. Bắt đầu phiên mới.");
      handleNewSession();
    }
  }, [handleNewSession]);
  const loadSessions = useCallback(async (selectSessionId?: string) => {
    const response = await chatService.listSessions();
    if (response.success && response.data) {
      setSessions(response.data);
      if (selectSessionId) {
        await loadCurrentSession(selectSessionId);
      } else if (response.data.length > 0 && chatService.getSessionId() === 'new') {
        const latestSession = response.data[0];
        await loadCurrentSession(latestSession.id);
      } else {
        await loadCurrentSession(chatService.getSessionId());
      }
    } else {
      await loadCurrentSession(chatService.getSessionId());
    }
  }, [loadCurrentSession]);
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const message = input.trim();
    setInput('');
    setIsLoading(true);
    let currentSessionId = chatService.getSessionId();
    if (currentSessionId === 'new') {
      const res = await chatService.createSession(undefined, undefined, message);
      if (res.success && res.data) {
        currentSessionId = res.data.sessionId;
        chatService.switchSession(currentSessionId);
        setSessions(prev => [{ id: res.data!.sessionId, title: res.data!.title, createdAt: Date.now(), lastActive: Date.now() }, ...prev]);
      } else {
        toast.error("Không thể tạo phiên mới.");
        setIsLoading(false);
        return;
      }
    }
    const userMessage = { id: crypto.randomUUID(), role: 'user' as const, content: message, timestamp: Date.now() };
    setChatState(prev => ({ ...prev, messages: [...prev.messages, userMessage], streamingMessage: '', sessionId: currentSessionId }));
    await chatService.sendMessage(message, chatState.model, (chunk) => {
      setChatState(prev => ({ ...prev, streamingMessage: (prev.streamingMessage || '') + chunk }));
    });
    await loadCurrentSession(currentSessionId);
    setIsLoading(false);
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  const handleModelChange = async (model: string) => {
    setChatState(prev => ({ ...prev, model }));
    if (chatService.getSessionId() !== 'new') {
      await chatService.updateModel(model);
    }
  };
  const handleSwitchSession = async (sessionId: string) => {
    await loadCurrentSession(sessionId);
    setIsSidebarOpen(false);
  };
  const handleDeleteSession = async (sessionId: string) => {
    const response = await chatService.deleteSession(sessionId);
    if (response.success) {
      toast.success("Đã xóa phiên.");
      const remainingSessions = sessions.filter(s => s.id !== sessionId);
      setSessions(remainingSessions);
      if (chatService.getSessionId() === sessionId) {
        if (remainingSessions.length > 0) {
          handleSwitchSession(remainingSessions[0].id);
        } else {
          handleNewSession();
        }
      }
    } else {
      toast.error("Lỗi khi xóa phiên.");
    }
  };
  const SessionSidebar = () => (
    <aside className="h-full w-72 flex flex-col bg-background/80 backdrop-blur-xl border-r p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary center text-primary-foreground">
            <Bot size={20} />
          </div>
          <h1 className="text-xl font-bold font-display">Oranji</h1>
        </div>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
          <X size={20} />
        </Button>
      </div>
      <Button onClick={handleNewSession} className="w-full mb-4">
        <Plus className="mr-2 h-4 w-4" /> Cuộc trò chuyện mới
      </Button>
      <div className="flex-1 overflow-y-auto -mr-2 pr-2 space-y-2">
        {sessions.map(session => (
          <div
            key={session.id}
            onClick={() => handleSwitchSession(session.id)}
            className={cn(
              "group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors",
              chatState.sessionId === session.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
            )}
          >
            <MessageSquare className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="truncate text-sm flex-1">{session.title}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-4 border-t">
        <Button variant="ghost" className="w-full justify-start">
          <Settings className="mr-2 h-4 w-4" /> C��i đặt
        </Button>
      </div>
    </aside>
  );
  return (
    <>
      <div className="h-[100vh] w-screen flex bg-secondary overflow-hidden">
        <div className="hidden lg:block">
          <SessionSidebar />
        </div>
        <main className="flex-1 flex flex-col relative h-full">
          <div className="absolute inset-0 bg-gradient-to-br from-[#F38020]/5 via-transparent to-[#D14615]/5" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full h-full flex flex-col">
            <div className="py-8 md:py-10 lg:py-12 h-full flex flex-col">
              <header className="flex items-center justify-between p-2 border-b bg-background/50 backdrop-blur-sm z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
                <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="lg:hidden">
                      <Menu />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-80">
                    <SessionSidebar />
                  </SheetContent>
                </Sheet>
                <div className="flex-1 flex justify-center">
                  <Select value={chatState.model} onValueChange={handleModelChange}>
                    <SelectTrigger className="w-auto md:w-[200px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELS.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ThemeToggle className="relative top-0 right-0" />
              </header>
              <div className="flex-1 overflow-hidden pt-4">
                <ChatWindow
                  chatState={chatState}
                  input={input}
                  isLoading={isLoading}
                  onInputChange={(e) => setInput(e.target.value)}
                  onSendMessage={handleSubmit}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <footer className="text-center text-xs text-muted-foreground p-2">
                Lưu ý: Hệ thống AI có hạn mức yêu cầu chung; số lần gọi API có thể bị giới hạn. Built with ❤️ at Cloudflare.
              </footer>
            </div>
          </div>
        </main>
      </div>
      <Toaster richColors />
    </>
  );
}
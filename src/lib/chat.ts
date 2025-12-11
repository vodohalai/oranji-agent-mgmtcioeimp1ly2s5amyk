import type { Message, ChatState, ToolCall, WeatherResult, MCPResult, ErrorResult, SessionInfo } from '../../worker/types';
export interface ChatResponse {
  success: boolean;
  data?: ChatState;
  error?: string;
}
export const MODELS = [
  { id: 'google-ai-studio/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'google-ai-studio/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'google-ai-studio/gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
];
export const MOCK_PRODUCTS = [
    { id: '1', name: 'S��n phẩm Oranji', description: 'Trợ lý AI tiếng Việt thông minh', price: 500000, stock_quantity: 100, category: 'AI' },
    { id: '2', name: 'Gói Cloudflare Worker', description: 'Triển khai ứng dụng serverless tại biên', price: 120000, stock_quantity: 1000, category: 'Infrastructure' },
    { id: '3', name: 'Lưu trữ R2', description: 'Lưu trữ đối tượng tương thích S3 với chi phí thấp', price: 5000, stock_quantity: 0, category: 'Storage' },
    { id: '4', name: 'Cơ sở d�� liệu D1', description: 'Cơ sở dữ liệu SQL serverless', price: 25000, stock_quantity: 0, category: 'Database' },
    { id: '5', name: 'Tư vấn triển khai AI', description: 'Dịch vụ tư vấn chuyên nghiệp cho dự án AI', price: 10000000, stock_quantity: 10, category: 'Service' },
];
export const generateSessionTitle = (content?: string): string => {
  if (!content) return `Trò chuyện lúc ${new Date().toLocaleTimeString()}`;
  return content.trim().substring(0, 40) + (content.length > 40 ? '...' : '');
};
class ChatService {
  private sessionId: string;
  private baseUrl: string;
  constructor() {
    this.sessionId = 'new';
    this.baseUrl = `/api/chat/${this.sessionId}`;
  }
  private async request<T>(url: string, options?: RequestInit): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await fetch(url, options);
      if (response.status === 204) {
        return { success: true };
      }
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || `HTTP ${response.status}` };
      }
      return data;
    } catch (error) {
      console.error(`Request to ${url} failed:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  }
  async sendMessage(message: string, model?: string, onChunk?: (chunk: string) => void): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, model, stream: !!onChunk }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (onChunk && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          onChunk(decoder.decode(value, { stream: true }));
        }
        return { success: true };
      }
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Failed to send message' };
    }
  }
  async getMessages(): Promise<ChatResponse> {
    return this.request<ChatState>(`${this.baseUrl}/messages`);
  }
  getSessionId(): string { return this.sessionId; }
  newSession(): void { this.switchSession('new'); }
  switchSession(sessionId: string): void {
    this.sessionId = sessionId;
    this.baseUrl = `/api/chat/${sessionId}`;
  }
  // Session Management
  async createSession(title?: string, sessionId?: string, firstMessage?: string) {
    return this.request<{ sessionId: string; title: string }>('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, sessionId, firstMessage })
    });
  }
  async listSessions() { return this.request<SessionInfo[]>('/api/sessions'); }
  async deleteSession(sessionId: string) { return this.request(`/api/sessions/${sessionId}`, { method: 'DELETE' }); }
  async clearMessages(): Promise<ChatResponse> {
    return this.request<ChatState>(`${this.baseUrl}/clear`, { method: 'POST' });
  }
  async clearAllSessions(): Promise<{ success: boolean }> {
    return this.request('/api/sessions/all', { method: 'DELETE' });
  }
  async updateModel(model: string) {
    return this.request<ChatState>(`${this.baseUrl}/model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model })
    });
  }
  async exportSessions(format: 'json' | 'csv'): Promise<{ success: boolean; blob?: Blob; error?: string }> {
    const res = await this.listSessions();
    if (!res.success || !res.data) {
      return { success: false, error: res.error || "No data to export" };
    }
    const data = res.data;
    if (format === 'json') {
      const json = JSON.stringify(data, null, 2);
      return { success: true, blob: new Blob([json], { type: 'application/json' }) };
    }
    const csvHeader = 'ID,Title,Created,Last Active\n';
    const csvRows = data.map(s => `${s.id},"${s.title.replace(/"/g, '""')}",${new Date(s.createdAt).toISOString()},${new Date(s.lastActive).toISOString()}`).join('\n');
    const csv = csvHeader + csvRows;
    return { success: true, blob: new Blob([csv], { type: 'text/csv;charset=utf-8;' }) };
  }
  // Admin: Products
  async getProducts() { return this.request<any[]>('/api/admin/products'); }
  async createProduct(data: any) {
    return this.request('/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  }
  async updateProduct(id: string, data: any) {
    return this.request(`/api/admin/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  }
  async deleteProduct(id: string) { return this.request(`/api/admin/products/${id}`, { method: 'DELETE' }); }
  // Admin: Documents
  async getDocuments() { return this.request<{ name: string; size: number; uploaded: string }[]>('/api/admin/documents'); }
  async uploadDocument(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/api/admin/documents', { method: 'POST', body: formData });
  }
  async deleteDocument(key: string) { return this.request(`/api/admin/documents/${encodeURIComponent(key)}`, { method: 'DELETE' }); }
  // Admin: System Prompt
  async getSystemPrompt() { return this.request<{ prompt: string }>('/api/admin/system-prompt'); }
  async updateSystemPrompt(prompt: string) {
    return this.request('/api/admin/system-prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
  }
}
export const chatService = new ChatService();
export const formatTime = (timestamp: number): string => new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const renderToolCall = (toolCall: ToolCall): string => {
  if (!toolCall.result) return `⚠️ ${toolCall.name}: No result`;
  if (typeof toolCall.result === 'object' && toolCall.result && 'error' in toolCall.result) return `❌ ${toolCall.name}: ${(toolCall.result as ErrorResult).error}`;
  return `✅ ${toolCall.name}: Executed`;
};
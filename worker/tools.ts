import type { WeatherResult, ErrorResult } from './types';
import { mcpManager } from './mcp-client';
import type { Env } from './core-utils';
export type ToolResult = WeatherResult | { content: string } | ErrorResult | { success: boolean } | { data: any[] };
interface SerpApiResponse {
  knowledge_graph?: { title?: string; description?: string; source?: { link?: string } };
  answer_box?: { answer?: string; snippet?: string; title?: string; link?: string };
  organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
  local_results?: Array<{ title?: string; address?: string; phone?: string; rating?: number }>;
  error?: string;
}
const customTools = [
  {
    type: 'function' as const,
    function: {
      name: 'get_weather',
      description: 'Get current weather information for a location',
      parameters: {
        type: 'object',
        properties: { location: { type: 'string', description: 'The city or location name' } },
        required: ['location']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description: 'Search the web using Google or fetch content from a specific URL',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query for Google search' },
          url: { type: 'string', description: 'Specific URL to fetch content from (alternative to search)' },
          num_results: { type: 'number', description: 'Number of search results to return (default: 5, max: 10)', default: 5 }
        },
        required: []
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_products',
      description: 'Truy xuất thông tin s���n phẩm từ cơ sở dữ liệu. Có thể lọc theo truy vấn hoặc danh mục.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Cụm từ tìm kiếm tên sản phẩm (ví dụ: "AI Agent")' },
          category: { type: 'string', description: 'Danh mục sản phẩm để lọc' },
          limit: { type: 'number', description: 'Số lượng kết quả tối đa trả về', default: 10 }
        },
        required: []
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'fetch_document',
      description: 'Truy xuất nội dung của một tài liệu đã t��i lên từ bộ nhớ R2.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Tên tệp của tài liệu cần truy xuất (ví dụ: "API_Guide.pdf")' }
        },
        required: ['key']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'save_chat_message',
      description: 'Lưu một tin nhắn vào lịch sử trò chuyện. Công cụ nội bộ, không dành cho người dùng.',
      parameters: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          sender_id: { type: 'string' },
          role: { type: 'string', enum: ['user', 'assistant'] },
          content: { type: 'string' },
          timestamp: { type: 'number' },
          tool_calls: { type: 'string' } // JSON string
        },
        required: ['session_id', 'role', 'content', 'timestamp']
      }
    }
  }
];
export async function getToolDefinitions() {
  const mcpTools = await mcpManager.getToolDefinitions();
  return [...customTools, ...mcpTools];
}
const createSearchUrl = (query: string, apiKey: string, numResults: number) => {
  const url = new URL('https://serpapi.com/search');
  url.searchParams.set('engine', 'google');
  url.searchParams.set('q', query);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('num', Math.min(numResults, 10).toString());
  return url.toString();
};
const formatSearchResults = (data: SerpApiResponse, query: string, numResults: number): string => {
  const results: string[] = [];
  if (data.knowledge_graph?.title && data.knowledge_graph.description) {
    results.push(`**${data.knowledge_graph.title}**\n${data.knowledge_graph.description}`);
    if (data.knowledge_graph.source?.link) results.push(`Source: ${data.knowledge_graph.source.link}`);
  }
  if (data.answer_box) {
    const { answer, snippet, title, link } = data.answer_box;
    if (answer) results.push(`**Answer**: ${answer}`);
    else if (snippet) results.push(`**${title || 'Answer'}**: ${snippet}`);
    if (link) results.push(`Source: ${link}`);
  }
  if (data.organic_results?.length) {
    results.push('\n**Search Results:**');
    data.organic_results.slice(0, numResults).forEach((result, index) => {
      if (result.title && result.link) {
        const text = [`${index + 1}. **${result.title}**`];
        if (result.snippet) text.push(`   ${result.snippet}`);
        text.push(`   Link: ${result.link}`);
        results.push(text.join('\n'));
      }
    });
  }
  return results.length ? `��� Search results for "${query}":\n\n${results.join('\n\n')}`
    : `No results found for "${query}". Try: https://www.google.com/search?q=${encodeURIComponent(query)}`;
};
async function performWebSearch(query: string, numResults = 5, env: Env): Promise<string> {
  const apiKey = env.SERPAPI_KEY;
  if (!apiKey) {
    return `🔍 Web search requires SerpAPI key. Get one at https://serpapi.com/\nFallback: https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }
  try {
    const response = await fetch(createSearchUrl(query, apiKey, numResults));
    if (!response.ok) throw new Error(`SerpAPI returned ${response.status}`);
    const data: SerpApiResponse = await response.json();
    if (data.error) throw new Error(`SerpAPI error: ${data.error}`);
    return formatSearchResults(data, query, numResults);
  } catch (error) {
    const fallback = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    return `Search failed: ${error instanceof Error ? error.message : 'API error'}. Try: ${fallback}`;
  }
}
const extractTextFromHtml = (html: string): string => html
  .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
async function fetchWebContent(url: string): Promise<string> {
  try {
    new URL(url);
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebBot/1.0)' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/')) throw new Error('Unsupported content type');
    const html = await response.text();
    const text = extractTextFromHtml(html);
    return text.length ? `Content from ${url}:\n\n${text.slice(0, 4000)}${text.length > 4000 ? '...' : ''}`
      : `No readable content found at ${url}`;
  } catch (error) {
    throw new Error(`Failed to fetch: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
const MOCK_PRODUCTS = [
    { id: '1', name: 'Sản phẩm Oranji', description: 'Trợ lý AI tiếng Việt thông minh', price: 500000, stock_quantity: 100, category: 'AI' },
    { id: '2', name: 'Gói Cloudflare Worker', description: 'Triển khai ứng dụng serverless tại biên', price: 120000, stock_quantity: 1000, category: 'Infrastructure' },
    { id: '3', name: 'Lưu trữ R2', description: 'Lưu trữ đối tượng tương thích S3 với chi phí thấp', price: 5000, stock_quantity: null, category: 'Storage' },
    { id: '4', name: 'Cơ sở dữ liệu D1', description: 'Cơ sở dữ liệu SQL serverless', price: 25000, stock_quantity: null, category: 'Database' },
    { id: '5', name: 'Tư vấn triển khai AI', description: 'Dịch vụ tư vấn chuyên nghiệp cho dự án AI', price: 10000000, stock_quantity: 10, category: 'Service' },
];
export async function executeTool(name: string, args: Record<string, unknown>, env: Env): Promise<ToolResult> {
  try {
    switch (name) {
      case 'get_weather':
        return {
          location: args.location as string,
          temperature: Math.floor(Math.random() * 40) - 10,
          condition: ['Sunny', 'Cloudy', 'Rainy', 'Snowy'][Math.floor(Math.random() * 4)],
          humidity: Math.floor(Math.random() * 100)
        };
      case 'web_search': {
        const { query, url, num_results = 5 } = args;
        if (typeof url === 'string') return { content: await fetchWebContent(url) };
        if (typeof query === 'string') return { content: await performWebSearch(query, num_results as number, env) };
        return { error: 'Either query or url parameter is required' };
      }
      case 'save_chat_message': {
        if (!env.DB) {
          console.log('DB binding not found. Skipping chat log persistence.', args);
          return { success: true };
        }
        const { session_id, sender_id, role, content, timestamp, tool_calls } = args;
        await env.DB.prepare(
          `INSERT INTO chatlog (id, session_id, sender_id, role, content, timestamp, tool_calls) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(crypto.randomUUID(), session_id, sender_id || null, role, content, timestamp, tool_calls ? JSON.stringify(tool_calls) : null).run();
        // Prune old messages, keeping the last 20
        const pruneStmt = `
          DELETE FROM chatlog WHERE id IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY timestamp DESC) as rn
              FROM chatlog WHERE session_id = ?
            ) WHERE rn > 20
          )
        `;
        await env.DB.prepare(pruneStmt).bind(session_id).run();
        return { success: true };
      }
      case 'get_products': {
        if (!env.DB) {
          console.log('DB binding not found. Returning mock products.');
          return { data: MOCK_PRODUCTS };
        }
        const { query, category, limit = 10 } = args;
        let stmt = 'SELECT * FROM products_info';
        const conditions: string[] = [];
        const bindings: (string | number)[] = [];
        if (query && typeof query === 'string') {
          conditions.push('name LIKE ?');
          bindings.push(`%${query}%`);
        }
        if (category && typeof category === 'string') {
          conditions.push('category = ?');
          bindings.push(category);
        }
        if (conditions.length > 0) {
          stmt += ' WHERE ' + conditions.join(' AND ');
        }
        stmt += ' ORDER BY id LIMIT ?';
        bindings.push(limit as number);
        const { results } = await env.DB.prepare(stmt).bind(...bindings).all();
        return { data: results };
      }
      case 'fetch_document': {
        const { key } = args;
        if (!key || typeof key !== 'string') return { error: 'Document key is required.' };
        if (env.R2_DOCS) {
          const object = await env.R2_DOCS.get(key);
          if (object === null) return { content: `Tài liệu '${key}' không tồn tại.` };
          return { content: await object.text() };
        }
        // Fallback logic can be added here, e.g., public URL
        return { error: 'R2 binding not configured. Cannot fetch document.' };
      }
      default: {
        const content = await mcpManager.executeTool(name, args);
        return { content };
      }
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
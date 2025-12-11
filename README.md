# Oranji — Agent Chatbot Manager

Oranji is a sophisticated AI agent chatbot application built on Cloudflare Workers and Durable Objects, optimized for Vietnamese language support. It enables seamless chat interactions via a modern web interface or Facebook Page Messenger integration. The system maintains conversation history (up to the 20 most recent messages per user in D1's 'chatlog' table for efficiency), retrieves documents from R2 buckets, and queries product information from D1's 'products_info' table. Admins can manage the chatbot, sessions, documents, and products through an intuitive admin dashboard. The frontend features a stunning, responsive design using shadcn/ui and Tailwind CSS, with smooth micro-interactions and mobile-first responsiveness.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/vodohalai/oranji-agent-chatbot-manager)

## Features

- **Vietnamese-Optimized AI Chatbot**: Powered by Cloudflare AI Gateway with support for Gemini models; excels in natural Vietnamese conversations.
- **Conversation Persistence**: Stores chat history in D1 ('chatlog' table), retaining the 20 most recent messages per sender for context and cost efficiency.
- **Tool Integration**:
  - Document retrieval from R2 buckets for knowledge-based responses.
  - Product information lookup from D1 ('products_info' table).
  - Custom tools for web search, weather, and more via MCP servers.
- **Facebook Messenger Integration**: Webhook endpoint for receiving and responding to messages from Facebook Pages, mapping sender IDs to sessions.
- **Admin Dashboard**: Manage chatbot sessions, upload/edit documents to R2, CRUD operations on products in D1, and customize system prompts.
- **Session Management**: Create, switch, and delete chat sessions with automatic title generation and activity tracking.
- **Real-Time Streaming**: Smooth, streaming responses with tool usage badges and loading indicators.
- **Visual Excellence**: Modern UI with gradients, animations (Framer Motion), and responsive design across devices.
- **Security & Scalability**: Edge-first architecture with Durable Objects for stateful sessions; graceful fallbacks for D1/R2 bindings.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS v3, shadcn/ui (Radix UI primitives), Framer Motion (animations), Lucide React (icons), React Router, Tanstack Query (data fetching), Sonner (toasts), Zustand (state management).
- **Backend**: Cloudflare Workers, Hono (routing), Agents SDK (Durable Objects), OpenAI SDK (via Cloudflare AI Gateway), Model Context Protocol (MCP) for tools.
- **Persistence**: Cloudflare D1 (SQLite for chat logs and products), R2 (object storage for documents).
- **Integrations**: Facebook Messenger Webhooks, SerpAPI (web search fallback), Date-fns (formatting).
- **Dev Tools**: Bun (package manager), ESLint, TypeScript, Wrangler (Cloudflare CLI).

## Installation

This project uses Bun as the package manager for faster performance. Ensure you have Bun installed (v1.0+).

1. Clone the repository:
   ```
   git clone <repository-url>
   cd oranji-agent
   ```

2. Install dependencies:
   ```
   bun install
   ```

3. Set up environment variables in `wrangler.jsonc` (under `vars`):
   - `CF_AI_BASE_URL`: Your Cloudflare AI Gateway URL (e.g., `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai`).
   - `CF_AI_API_KEY`: Your Cloudflare AI API key.
   - For Facebook integration: Add `VERIFY_TOKEN` and `PAGE_ACCESS_TOKEN` as secrets via Wrangler.
   - Optional: `SERPAPI_KEY` for enhanced web search.

4. Generate TypeScript types for Workers bindings:
   ```
   bun run cf-typegen
   ```

5. For D1 and R2: Create bindings via Wrangler dashboard or CLI (e.g., `wrangler d1 create chatlog-db` and bind to your Worker). Update `wrangler.toml` if needed, but do not modify existing bindings.

The bootstrap script (`.bootstrap.js`) runs automatically on first install to configure the project.

## Usage

### Web Chat Interface
- Navigate to the homepage (`/`) for the main chat UI.
- Start typing to create a new session; responses stream in real-time.
- Switch models (e.g., Gemini 2.5 Flash) via the selector.
- Use session management to create, switch, or delete conversations.

### Facebook Messenger Integration
1. Set up a Facebook App and Page with Messenger enabled.
2. Configure the webhook URL: `https://your-worker.your-subdomain.workers.dev/api/messenger/webhook`.
3. Verify with your `VERIFY_TOKEN` and subscribe to Messenger events.
4. Messages from users are mapped to sessions and routed to the AI agent.

### Admin Dashboard
- Access via `/admin` (implement authentication as needed).
- View/manage sessions, upload documents to R2, edit products in D1, and adjust prompts.

### API Endpoints (for custom integrations)
- `POST /api/chat/:sessionId/chat`: Send a message (supports streaming).
- `GET /api/chat/:sessionId/messages`: Retrieve session messages.
- `POST /api/sessions`: Create a new session.
- `GET /api/sessions`: List sessions.
- `DELETE /api/messenger/webhook`: Handle Facebook webhooks.

Example client-side chat (using the provided `chatService`):
```tsx
import { chatService } from '@/lib/chat';

const handleSend = async (message: string) => {
  const response = await chatService.sendMessage(message, (chunk) => {
    console.log('Streaming:', chunk);
  });
  if (response.success) {
    // Handle success
  }
};
```

## Development

- **Local Development**:
  1. Start the dev server:
     ```
     bun run dev
     ```
     Access at `http://localhost:3000` (or your configured port).

  2. For Worker backend:
     ```
     wrangler dev
     ```
     This proxies API calls to the local Worker.

- **Hot Reloading**: Vite provides instant updates for frontend changes; Worker routes reload on save.

- **Testing Tools**:
  - Use the admin panel to test D1/R2 integrations.
  - Mock Facebook webhooks with tools like ngrok for local testing.
  - Monitor logs via `wrangler tail` or Cloudflare dashboard.

- **Best Practices**:
  - Extend the `ChatAgent` class in `worker/agent.ts` for custom logic.
  - Add MCP servers in `worker/mcp-client.ts` for new tools.
  - Ensure UTF-8 handling for Vietnamese text.
  - Follow UI non-negotiables: Use shadcn/ui components, Tailwind-safe utilities, and responsive wrappers.

- **Rate Limits Note**: Cloudflare AI Gateway has shared quotas across apps. Monitor usage in the dashboard; the app displays a footer warning.

## Deployment

Deploy to Cloudflare Workers for global edge execution with Durable Objects for state.

1. Ensure environment variables are set in the Wrangler dashboard (under your Worker > Settings > Variables).
   - Bind D1 database (`chatlog`) and R2 bucket (documents) via the dashboard.
   - Add secrets for Facebook tokens.

2. Build the frontend:
   ```
   bun run build
   ```

3. Deploy:
   ```
   bun run deploy
   ```
   Or use Wrangler CLI:
   ```
   wrangler deploy
   ```

4. For custom domains: Configure in the Cloudflare dashboard under Workers > Triggers > Custom Domains.

5. Post-Deployment:
   - Verify webhook for Messenger at `https://your-worker.your-subdomain.workers.dev/api/messenger/webhook`.
   - Test D1/R2 access; fallbacks use mock data if bindings are missing.
   - Monitor observability in the dashboard (enabled by default).

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/vodohalai/oranji-agent-chatbot-manager)

## Contributing

Contributions are welcome! Fork the repo, create a feature branch, and submit a PR. Focus on:
- Enhancing tool integrations (e.g., more MCP servers).
- UI/UX improvements following the visual excellence standards.
- Vietnamese language refinements.

Please adhere to the codebase structure and avoid modifying core template files (e.g., `worker/index.ts`).

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Support

For issues, open a GitHub issue. For Cloudflare-specific help, refer to the [Workers documentation](https://developers.cloudflare.com/workers/). Note the AI request limits across apps—contact Cloudflare support for quota increases.
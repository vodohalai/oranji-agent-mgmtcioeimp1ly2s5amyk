import { Hono } from "hono";
import { getAgentByName } from 'agents';
import { ChatAgent } from './agent';
import { API_RESPONSES } from './config';
import { Env, getAppController, registerSession, unregisterSession, getSystemPrompt } from "./core-utils";
export function coreRoutes(app: Hono<{ Bindings: Env }>) {
    app.all('/api/chat/:sessionId/*', async (c) => {
        try {
            const sessionId = c.req.param('sessionId');
            const agent = await getAgentByName<Env, ChatAgent>(c.env.CHAT_AGENT, sessionId);
            const url = new URL(c.req.url);
            url.pathname = url.pathname.replace(`/api/chat/${sessionId}`, '');
            return agent.fetch(new Request(url.toString(), {
                method: c.req.method,
                headers: c.req.header(),
                body: c.req.method === 'GET' || c.req.method === 'DELETE' ? undefined : c.req.raw.body
            }));
        } catch (error) {
            console.error('Agent routing error:', error);
            return c.json({ success: false, error: API_RESPONSES.AGENT_ROUTING_FAILED }, { status: 500 });
        }
    });
}
export function userRoutes(app: Hono<{ Bindings: Env }>) {
    // Session Management
    app.get('/api/sessions', async (c) => {
        const controller = getAppController(c.env);
        const sessions = await controller.listSessions();
        return c.json({ success: true, data: sessions });
    });
    app.post('/api/sessions', async (c) => {
        const body = await c.req.json().catch(() => ({}));
        const { title, sessionId: providedSessionId, firstMessage } = body;
        const sessionId = providedSessionId || crypto.randomUUID();
        let sessionTitle = title || `Trò chuyện lúc ${new Date().toLocaleTimeString()}`;
        if (!title && firstMessage) {
            sessionTitle = firstMessage.trim().substring(0, 40) + '...';
        }
        await registerSession(c.env, sessionId, sessionTitle);
        return c.json({ success: true, data: { sessionId, title: sessionTitle } });
    });
    app.delete('/api/sessions/all', async (c) => {
        const controller = getAppController(c.env);
        await controller.clearAllSessions();
        return c.json({ success: true });
    });
    app.delete('/api/sessions/:sessionId', async (c) => {
        const sessionId = c.req.param('sessionId');
        const deleted = await unregisterSession(c.env, sessionId);
        return c.json({ success: deleted, data: { deleted } });
    });
    // Admin: Products (D1)
    app.get('/api/admin/products', async (c) => {
        if (!c.env.DB) return c.json({ success: false, error: 'Database not configured' }, 500);
        const { results } = await c.env.DB.prepare('SELECT * FROM products_info ORDER BY name').all();
        return c.json({ success: true, data: results });
    });
    app.post('/api/admin/products', async (c) => {
        if (!c.env.DB) return c.json({ success: false, error: 'Database not configured' }, 500);
        const product = await c.req.json();
        const id = product.id || crypto.randomUUID();
        await c.env.DB.prepare(
            'INSERT INTO products_info (id, name, description, price, stock_quantity, category, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(id, product.name, product.description, product.price, product.stock_quantity, product.category, JSON.stringify(product.metadata || {})).run();
        return c.json({ success: true, data: { ...product, id } });
    });
    app.put('/api/admin/products/:id', async (c) => {
        if (!c.env.DB) return c.json({ success: false, error: 'Database not configured' }, 500);
        const id = c.req.param('id');
        const product = await c.req.json();
        await c.env.DB.prepare(
            'UPDATE products_info SET name=?, description=?, price=?, stock_quantity=?, category=?, metadata=? WHERE id=?'
        ).bind(product.name, product.description, product.price, product.stock_quantity, product.category, JSON.stringify(product.metadata || {}), id).run();
        return c.json({ success: true, data: product });
    });
    app.delete('/api/admin/products/:id', async (c) => {
        if (!c.env.DB) return c.json({ success: false, error: 'Database not configured' }, 500);
        const id = c.req.param('id');
        await c.env.DB.prepare('DELETE FROM products_info WHERE id = ?').bind(id).run();
        return c.json({ success: true });
    });
    // Admin: Documents (R2)
    app.get('/api/admin/documents', async (c) => {
        if (!c.env.R2_DOCS) return c.json({ success: false, error: 'R2 Storage not configured' }, 500);
        const listed = await c.env.R2_DOCS.list();
        const documents = listed.objects.map(obj => ({
            name: obj.key,
            size: obj.size,
            uploaded: obj.uploaded.toISOString(),
        }));
        return c.json({ success: true, data: documents });
    });
    app.post('/api/admin/documents', async (c) => {
        if (!c.env.R2_DOCS) return c.json({ success: false, error: 'R2 Storage not configured' }, 500);
        const formData = await c.req.formData();
        const file = formData.get('file') as File;
        if (!file) return c.json({ success: false, error: 'File not provided' }, 400);
        await c.env.R2_DOCS.put(file.name, file.stream(), {
            httpMetadata: { contentType: file.type },
        });
        return c.json({ success: true, data: { name: file.name, size: file.size } });
    });
    app.delete('/api/admin/documents/:key', async (c) => {
        if (!c.env.R2_DOCS) return c.json({ success: false, error: 'R2 Storage not configured' }, 500);
        const key = decodeURIComponent(c.req.param('key'));
        await c.env.R2_DOCS.delete(key);
        return c.json({ success: true });
    });
    // Admin: System Prompt
    app.get('/api/admin/system-prompt', async (c) => {
        const prompt = await getSystemPrompt(c.env);
        return c.json({ success: true, data: { prompt } });
    });
    app.post('/api/admin/system-prompt', async (c) => {
        const { prompt } = await c.req.json();
        if (typeof prompt !== 'string') return c.json({ success: false, error: 'Prompt is required' }, 400);
        const controller = getAppController(c.env);
        await controller.fetch(new Request('http://do/postSystemPrompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        }));
        return c.json({ success: true });
    });
    // Messenger Webhook
    app.get('/api/messenger/webhook', async (c) => {
        const url = new URL(c.req.url);
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');
        if (mode === 'subscribe' && token === c.env.FB_VERIFY_TOKEN) {
            console.log('Webhook verified!');
            return new Response(challenge, { status: 200 });
        }
        console.warn('Webhook verification failed.');
        return c.text('Forbidden', 403);
    });
    app.post('/api/messenger/webhook', async (c) => {
        const body: any = await c.req.json();
        if (body.object !== 'page') return c.text('OK', 200);
        for (const entry of body.entry) {
            for (const event of entry.messaging) {
                if (event.message && event.sender) {
                    const senderId = event.sender.id;
                    const messageText = event.message.text;
                    const sessionId = `fb-${senderId}`; // Map senderId to a unique sessionId
                    const chatBody = {
                        message: messageText,
                        sender_id: senderId,
                        model: 'google-ai-studio/gemini-2.5-flash',
                        stream: true
                    };
                    const agentUrl = new URL(c.req.url);
                    agentUrl.pathname = `/api/chat/${sessionId}/chat`;
                    const agentRes = await fetch(agentUrl.toString(), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(chatBody)
                    });
                    let streamText = await agentRes.text().then(text => text.trim()).catch(() => '');
                    if (streamText.length === 0) {
                        streamText = 'Xin lỗi, không thể xử lý tin nhắn lúc này.';
                    }
                    const reply = {
                        recipient: { id: senderId },
                        message: { text: streamText }
                    };
                    await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${c.env.FB_PAGE_TOKEN}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(reply)
                    });
                }
            }
        }
        return c.text('OK', 200);
    });
}
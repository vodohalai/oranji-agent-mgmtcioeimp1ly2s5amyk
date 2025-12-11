import type { AppController } from './app-controller';
import type { ChatAgent } from './agent';
export interface Env {
    CF_AI_BASE_URL: string;
    CF_AI_API_KEY: string;
    SERPAPI_KEY: string;
    OPENROUTER_API_KEY: string;
    CHAT_AGENT: DurableObjectNamespace<ChatAgent>;
    APP_CONTROLLER: DurableObjectNamespace<AppController>;
    DB?: D1Database;
    R2_DOCS?: R2Bucket;
    FB_VERIFY_TOKEN?: string;
    FB_PAGE_TOKEN?: string;
}
export function getAppController(env: Env): DurableObjectStub<AppController> {
  const id = env.APP_CONTROLLER.idFromName("controller");
  return env.APP_CONTROLLER.get(id);
}
export async function registerSession(env: Env, sessionId: string, title?: string): Promise<void> {
  try {
    const controller = getAppController(env);
    await controller.addSession(sessionId, title);
  } catch (error) {
    console.error('Failed to register session:', error);
  }
}
export async function updateSessionActivity(env: Env, sessionId: string): Promise<void> {
  try {
    const controller = getAppController(env);
    await controller.updateSessionActivity(sessionId);
  } catch (error) {
    console.error('Failed to update session activity:', error);
  }
}
export async function unregisterSession(env: Env, sessionId: string): Promise<boolean> {
  try {
    const controller = getAppController(env);
    return await controller.removeSession(sessionId);
  } catch (error) {
    console.error('Failed to unregister session:', error);
    return false;
  }
}
export async function getSystemPrompt(env: Env): Promise<string | null> {
    try {
        const controller = getAppController(env);
        const response = await controller.fetch('http://do/getSystemPrompt');
        if (response.ok) {
            const data = await response.json<{prompt: string}>();
            return data.prompt;
        }
        return null;
    } catch (error) {
        console.error('Failed to get system prompt:', error);
        return null;
    }
}
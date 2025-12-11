import OpenAI from 'openai';
import type { Message, ToolCall } from './types';
import { getToolDefinitions, executeTool } from './tools';
import { ChatCompletionMessageFunctionToolCall } from 'openai/resources/index.mjs';
import type { Env } from './core-utils';
const VIETNAMESE_SYSTEM_PROMPT = "Bạn là một trợ lý AI thông thạo tiếng Việt, được tích hợp vào ứng dụng Oranji. Nhiệm vụ của bạn là hỗ trợ người dùng một cách tự nhiên và hữu ích. Bạn có khả năng truy xuất thông tin sản phẩm từ cơ sở dữ liệu D1 và tìm kiếm nội dung tài liệu từ bộ nhớ R2. Hãy luôn trả lời bằng tiếng Việt, trừ khi được yêu cầu sử dụng ngôn ngữ khác. Giữ ngữ cảnh từ 20 tin nhắn gần nhất để cuộc trò chuyện được liền mạch.";
export class ChatHandler {
  private client: OpenAI;
  private model: string;
  private env: Env;
  private sessionId: string;
  constructor(aiGatewayUrl: string, apiKey: string, model: string, env: Env, sessionId: string) {
    this.client = new OpenAI({
      baseURL: aiGatewayUrl,
      apiKey: apiKey
    });
    this.model = model;
    this.env = env;
    this.sessionId = sessionId;
  }
  private async saveToChatlog(messages: Message[]): Promise<void> {
    const validMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');
    for (const msg of validMessages) {
      try {
        await executeTool('save_chat_message', {
          session_id: this.sessionId,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          tool_calls: msg.toolCalls || null
        }, this.env);
      } catch (e) {
        console.error(`Failed to save message ${msg.id} to chatlog:`, e);
      }
    }
  }
  async processMessage(
    message: string,
    conversationHistory: Message[],
    onChunk?: (chunk: string) => void
  ): Promise<{
    content: string;
    toolCalls?: ToolCall[];
    userMessage: Message;
    assistantMessage: Message;
  }> {
    const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        timestamp: Date.now()
    };
    const messages = this.buildConversationMessages(message, conversationHistory);
    const toolDefinitions = await getToolDefinitions();
    if (onChunk) {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: toolDefinitions,
        tool_choice: 'auto',
        stream: true,
      });
      const result = await this.handleStreamResponse(stream, messages, onChunk);
      await this.saveToChatlog([userMessage, result.assistantMessage]);
      return { ...result, userMessage };
    }
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools: toolDefinitions,
      tool_choice: 'auto',
    });
    const result = await this.handleNonStreamResponse(completion, messages);
    await this.saveToChatlog([userMessage, result.assistantMessage]);
    return { ...result, userMessage };
  }
  private async handleStreamResponse(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    conversation: any[],
    onChunk: (chunk: string) => void
  ) {
    let fullContent = '';
    const accumulatedToolCalls: ChatCompletionMessageFunctionToolCall[] = [];
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        fullContent += delta.content;
        onChunk(delta.content);
      }
      if (delta?.tool_calls) {
        for (let i = 0; i < delta.tool_calls.length; i++) {
          const deltaToolCall = delta.tool_calls[i];
          if (!accumulatedToolCalls[i]) {
            accumulatedToolCalls[i] = { id: deltaToolCall.id || `tool_${Date.now()}_${i}`, type: 'function', function: { name: deltaToolCall.function?.name || '', arguments: deltaToolCall.function?.arguments || '' } };
          } else {
            if (deltaToolCall.function?.name) accumulatedToolCalls[i].function.name = deltaToolCall.function.name;
            if (deltaToolCall.function?.arguments) accumulatedToolCalls[i].function.arguments += deltaToolCall.function.arguments;
          }
        }
      }
    }
    const assistantMessage: Message = { id: crypto.randomUUID(), role: 'assistant', content: fullContent, timestamp: Date.now() };
    if (accumulatedToolCalls.length > 0) {
      const executedTools = await this.executeToolCalls(accumulatedToolCalls);
      const finalResponse = await this.generateToolResponse(conversation, accumulatedToolCalls, executedTools);
      assistantMessage.content = finalResponse;
      assistantMessage.toolCalls = executedTools;
      onChunk(finalResponse.substring(fullContent.length)); // Stream the final part
      return { content: finalResponse, toolCalls: executedTools, assistantMessage };
    }
    return { content: fullContent, assistantMessage };
  }
  private async handleNonStreamResponse(
    completion: OpenAI.Chat.Completions.ChatCompletion,
    conversation: any[]
  ) {
    const responseMessage = completion.choices[0]?.message;
    if (!responseMessage) {
      const content = 'I apologize, but I encountered an issue processing your request.';
      const assistantMessage: Message = { id: crypto.randomUUID(), role: 'assistant', content, timestamp: Date.now() };
      return { content, assistantMessage };
    }
    const assistantMessage: Message = { id: crypto.randomUUID(), role: 'assistant', content: responseMessage.content || '', timestamp: Date.now() };
    if (!responseMessage.tool_calls) {
      return { content: responseMessage.content || 'I apologize, but I encountered an issue.', assistantMessage };
    }
    const toolCalls = await this.executeToolCalls(responseMessage.tool_calls as ChatCompletionMessageFunctionToolCall[]);
    const finalResponse = await this.generateToolResponse(conversation, responseMessage.tool_calls, toolCalls);
    assistantMessage.content = finalResponse;
    assistantMessage.toolCalls = toolCalls;
    return { content: finalResponse, toolCalls, assistantMessage };
  }
  private async executeToolCalls(openAiToolCalls: ChatCompletionMessageFunctionToolCall[]): Promise<ToolCall[]> {
    return Promise.all(
      openAiToolCalls.map(async (tc) => {
        try {
          const args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
          const result = await executeTool(tc.function.name, args, this.env);
          return { id: tc.id, name: tc.function.name, arguments: args, result };
        } catch (error) {
          return { id: tc.id, name: tc.function.name, arguments: {}, result: { error: `Failed to execute ${tc.function.name}: ${error instanceof Error ? error.message : 'Unknown error'}` } };
        }
      })
    );
  }
  private async generateToolResponse(
    history: any[],
    openAiToolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
    toolResults: ToolCall[]
  ): Promise<string> {
    const followUpCompletion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        ...history,
        { role: 'assistant', content: null, tool_calls: openAiToolCalls },
        ...toolResults.map((result) => ({
          role: 'tool' as const,
          content: JSON.stringify(result.result),
          tool_call_id: result.id
        }))
      ],
    });
    return followUpCompletion.choices[0]?.message?.content || 'Tool results processed successfully.';
  }
  private buildConversationMessages(userMessage: string, history: Message[]) {
    const validHistory = history
      .slice(-20)
      .filter(m => ['user', 'assistant'].includes(m.role))
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    return [
      { role: 'system' as const, content: VIETNAMESE_SYSTEM_PROMPT },
      ...validHistory,
      { role: 'user' as const, content: userMessage }
    ];
  }
  updateModel(newModel: string): void {
    this.model = newModel;
  }
}
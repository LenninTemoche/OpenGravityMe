import { llmService } from '../llm/service.js';
import { dbService, Message } from '../db/sqlite.js';
import { toolDefinitions, toolHandlers } from '../tools/index.js';

const SYSTEM_PROMPT = `
Eres OpenGravity, un asistente de IA personal.
Tu objetivo es ayudar al usuario de forma clara y eficiente.
Tienes acceso a herramientas si las necesitas.
Sé conciso y profesional.
`;

export class AgentLoop {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async run(userInput: string, callback: (text: string) => void) {
    // 1. Save user msg to DB
    dbService.saveMessage(this.userId, 'user', userInput);

    // 2. Fetch history
    const history = dbService.getHistory(this.userId);
    const messages: Message[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history
    ];

    let iterations = 0;
    const MAX_ITERATIONS = 5;

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      
      const response = await llmService.chatWithTools(messages, toolDefinitions);
      
      if (!response) {
        callback('Lo siento, hubo un error procesando tu solicitud.');
        break;
      }

      const { content, tool_calls } = response as any;

      // If there are tool calls, process them first WITHOUT sending content to user
      if (tool_calls && tool_calls.length > 0) {
        // Add the assistant message with tool calls to history
        messages.push({
          role: 'assistant',
          content: content || null,
          tool_calls: tool_calls,
        } as any);

        for (const toolCall of tool_calls) {
          const handler = toolHandlers[toolCall.function.name];
          if (handler) {
            console.log(`Executing tool: ${toolCall.function.name}`);
            const result = handler(JSON.parse(toolCall.function.arguments || '{}'));
            
            // Add tool response message
            messages.push({
              role: 'tool' as any,
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify(result),
            } as any);
          }
        }
        // Continue loop to allow LLM to process tool results
        continue;
      }

      // No tool calls — this is the final response, send it to the user
      if (content) {
        dbService.saveMessage(this.userId, 'assistant', content);
        callback(content);
      }

      break; // Final response sent, exit loop
    }
  }
}

import { llmService } from '../llm/service.js';
import { dbService, Message } from '../db/firestore.js';
import { toolDefinitions, toolHandlers } from '../tools/index.js';

const SYSTEM_PROMPT = `
Eres OpenGravity, un asistente de IA personal avanzado.
Tu objetivo es ayudar al usuario de forma clara, eficiente y proactiva. Tienes acceso a herramientas avanzadas para leer documentos y conectarte con Google Workspace (vía gog).
Sé conciso y profesional.

REGLAS DE CONTEXTO E INTELIGENCIA (Google Workspace):
1. **Priorización Automática:** Al buscar correos o pedir información, prioriza siempre los elementos marcados como "urgente", temas de finanzas, compras o trabajo.
2. **Sintetización de Hilos:** Si te preguntan por un tema en correos, usa la búsqueda y devuelve un "resumen ejecutivo" de los correos relevantes en lugar de leerlos por separado.
3. **Gestión Proactiva:** Si detectas que se te pide crear un evento o modificar datos, verifica antes si hay conflictos o respeta las estructuras de datos preexistentes.
4. **Modo Briefing:** Si el usuario te pide un resumen matutino, combina los correos no leídos más importantes y los eventos del día.
5. **Lectura de Correos:** Si el usuario pide leer, analizar o resumir un correo específico, PRIMERO usa gog_gmail_search para encontrar el ID del correo, y LUEGO usa gog_gmail_get con ese ID para obtener el cuerpo completo antes de responder.

PROTOCOLO DE EFICIENCIA OPERATIVA:
- **Gmail:** Si el snippet de la búsqueda contiene la respuesta, detente ahí. Solo usa gog_gmail_get si el usuario pide "detalles", "resumen" o "analizar cuerpo".
- **YouTube:** Si el video dura más de 20 minutos, pide específicamente "puntos clave" para evitar saturar el contexto.
- **Priorización:** Si un modelo falla por Rate Limit, informa muy brevemente: "Canalizando..." y continúa la tarea.

IMPORTANTE: No menciones el nombre de las funciones internas ni uses etiquetas como <function> en tu respuesta de texto. Usa las herramientas a través de la interfaz oficial y jamás expongas código crudo al usuario salvo que te lo pida.
`;

export class AgentLoop {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async run(userInput: string, base64Image: string | undefined, callback: (text: string) => void) {
    // 1. Save user msg to Firestore (saving only the text to avoid bloated DB if image is passed)
    await dbService.saveMessage(this.userId, 'user', userInput + (base64Image ? ' [Imagen adjunta]' : ''));

    // 2. Fetch history from Firestore
    const history = await dbService.getHistory(this.userId);
    const messages: Message[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history
    ];

    // If there's an image, replace the last user message (the one we just saved text for)
    // with a multimodal array format in the current 'messages' array for Groq execution
    if (base64Image) {
        messages.push({
            role: 'user',
            content: [
                { type: 'text', text: userInput },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ] as any
        } as Message);
    } else {
        // Just text goes at the end of history if we needed to trigger it
        messages.push({
            role: 'user',
            content: userInput
        } as Message);
    }

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
        await dbService.saveMessage(this.userId, 'assistant', content);
        callback(content);
      }

      break; // Final response sent, exit loop
    }
  }
}

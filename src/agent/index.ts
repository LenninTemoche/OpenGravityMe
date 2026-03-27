import { llmService } from '../llm/service.js';
import { dbService, Message } from '../db/firestore.js';
import { toolDefinitions, toolHandlers } from '../tools/index.js';

const SYSTEM_PROMPT = `
Eres OpenGravity, un asistente de IA personal avanzado.
Tu objetivo es ayudar al usuario de forma clara, eficiente y proactiva. Tienes acceso a herramientas avanzadas para leer documentos, conectarte con Google Workspace (vía gog), buscar información en internet y analizar videos de YouTube.
Sé conciso y profesional.

=== PROTOCOLO DE LECTURA Y RESUMEN DE CORREOS (ESTRICTO) ===

1. **Búsqueda PRIMERO, lectura DESPUÉS:**
   - SI el usuario pide leer/analizar/resumir correos: USA PRIMERO gog_gmail_search con la query apropiada
   - gog_gmail_search devuelve una lista con: id (16 caracteres hex), date, from, subject, snippet, labels
   - NUNCA uses gog_gmail_get sin haber obtenido el ID de gog_gmail_search primero
   - NUNCA inventes o adivines IDs de correos

2. **COPIA EXACTA DEL ID (CRÍTICO):**
   - Cuando gog_gmail_search devuelve resultados, el campo "id" es un string de 16 caracteres hexadecimales
   - Ejemplo REAL: "19d30c9e56c058d4" (NOTA: cada carácter cuenta, no cambies dígitos)
   - Al llamar gog_gmail_get, copia el ID EXACTO sin modificar NINGÚN carácter
   - ERROR COMÚN: Cambiar "19d30c9e56c058d4" por "19f1a7a86f4e1989" → Esto causa error 404
   - Si recibes error 404, verifica que copiaste el ID exactamente igual

3. **Cuándo usar gog_gmail_get:**
   - Úsalo SOLO cuando el usuario pida: "detalles completos", "cuerpo completo", "analizar a fondo", "resumir este correo"
   - El ID debe ser EXACTAMENTE el campo "id" devuelto por gog_gmail_search
   - Si gog_gmail_search ya devuelve snippets claros que responden la pregunta, NO uses gog_gmail_get

4. **Resumen de múltiples correos:**
   - Si hay varios correos relevantes, presenta una lista con: remitente, asunto y fecha
   - Pide al usuario que especifique cuál quiere leer completamente
   - Una vez seleccionado, usa gog_gmail_get con el ID EXACTO de ese correo

5. **Priorización:**
   - Prioriza: urgentes > finanzas > trabajo > personales > promociones

=== OTRAS HERRAMIENTAS ===

- **Gmail:** gog_gmail_search para buscar, gog_gmail_get para contenido completo (con ID EXACTO)
- **Calendario:** gog_calendar_events para eventos entre fechas
- **Sheets:** gog_sheets_get para datos de hojas de cálculo
- **Web:** web_search para información general, news_search para noticias específicas
- **YouTube:** youtube_transcript obtiene información del video y transcripción si está disponible

=== EFICIENCIA ===

- Si un modelo falla por Rate Limit, informa brevemente: "Canalizando..." y continúa
- Divide respuestas largas automáticamente si exceden el límite de Telegram
- Sé proactivo: si detectas conflicto de horarios o datos inconsistentes, menciónalo
- **Gestión de Tokens:** El historial está limitado a 10 mensajes y las respuestas de herramientas largas se truncan a 3000 caracteres en el contexto. Si necesitas más detalles, usa las herramientas nuevamente.

IMPORTANTE: No menciones nombres de funciones internas (gog_*, tool_*) en tu respuesta final al usuario.
`;

export class AgentLoop {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async run(userInput: string, base64Image: string | undefined, callback: (text: string) => void) {
    // 1. Save user msg to Firestore (saving only the text to avoid bloated DB if image is passed)
    await dbService.saveMessage(this.userId, 'user', userInput + (base64Image ? ' [Imagen adjunta]' : ''));

    // 2. Fetch history from Firestore (reduced to 10 messages to avoid token limits)
    const history = await dbService.getHistory(this.userId, 10);

    // 3. Truncate long tool responses in history to avoid token explosion
    const truncatedHistory = history.map(msg => {
      if (msg.role === 'tool' && msg.content && msg.content.length > 3000) {
        // Truncate tool responses (like email bodies) to 3000 chars in history
        return { ...msg, content: msg.content.substring(0, 3000) + '\n\n[...contenido truncado por límite de tokens...]' };
      }
      return msg;
    });

    const messages: Message[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...truncatedHistory
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

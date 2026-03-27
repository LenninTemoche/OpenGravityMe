import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { webSearch, newsSearch } from './web-search.js';
import { getYouTubeTranscript } from './youtube.js';

// Resolver directorio raíz de forma segura en ESM (NodeNext)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// __dirname apunta a src/tools, subir dos niveles para llegar al root donde está gog.exe
const projectRoot = path.join(__dirname, '..', '..');

// Función para limpiar el cuerpo de los correos (eliminar HTML, CSS, JS)
function cleanEmailBody(text: string): string {
  if (!text) return "";
  return text
    .replace(/<style([\s\S]*?)<\/style>/gi, '') // Elimina CSS
    .replace(/<script([\s\S]*?)<\/script>/gi, '') // Elimina JS
    .replace(/<[^>]+>/g, ' ') // Elimina etiquetas HTML
    .replace(/\s+/g, ' ') // Normaliza espacios
    .replace(/\n{3,}/g, '\n\n') // Normaliza saltos de línea múltiples
    .trim()
    .substring(0, 25000); // Límite de seguridad para modelos de 16k-32k context
}

// Validación estricta de ID de hilo de Gmail (16 caracteres hex)
function isValidGmailThreadId(id: string): boolean {
  return /^[a-f0-9]{16}$/i.test(id);
}

// Helpers para ejecutar gog CLI
function runGogCommand(args: string[]): any {
  try {
    const gogPath = process.platform === 'win32' ? path.join(projectRoot, 'gog.exe') : 'gog';
    const cmd = `"${gogPath}" ${args.join(' ')}`;
    console.log(`[GOG] Ejecutando: ${cmd}`);
    // maxBuffer aumentado a 10MB para manejar grandes volúmenes de hilos de correo
    const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    try {
      const result = JSON.parse(output);
      // Limpiar el cuerpo del correo si existe
      if (result.body) {
        result.body = cleanEmailBody(result.body);
      }
      return result;
    } catch {
      return output;
    }
  } catch (error: any) {
    console.error(`[GOG Error] ${error.message}`);
    return { error: error.message || 'Error executing gog command' };
  }
}

export const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: 'Obtiene la fecha y hora actual en formato ISO.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gog_gmail_search',
      description: 'Busca correos en Gmail usando sintaxis avanzada (ej: "newer_than:1d is:unread"). Devuelve un resumen de los hilos.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Query de búsqueda de Gmail (ej. is:unread)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gog_calendar_events',
      description: 'Obtiene los eventos del calendario "primary" entre dos fechas ISO.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Fecha de inicio ISO (ej. 2026-03-26T00:00:00Z)' },
          to: { type: 'string', description: 'Fecha de fin ISO (ej. 2026-03-26T23:59:59Z)' },
        },
        required: ['from', 'to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gog_sheets_get',
      description: 'Extrae datos de una hoja de Google Sheets en formato JSON.',
      parameters: {
        type: 'object',
        properties: {
          sheetId: { type: 'string', description: 'ID de la hoja de Sheets' },
          range: { type: 'string', description: 'Rango a extraer (ej. "Hoja1!A1:E20")' },
        },
        required: ['sheetId', 'range'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gog_gmail_get',
      description: 'Obtiene el contenido COMPLETO de un correo específico usando el ID del hilo. REQUISITO: El ID debe ser el campo "id" (16 caracteres hex) devuelto por gog_gmail_search. Ejemplo: si gog_gmail_search devuelve {"id": "19d1c57009c3ebd8", ...}, usa ese ID exacto. NUNCA inventes o adivines IDs.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID del hilo de Gmail (16 caracteres hex, ej: "19d1c57009c3ebd8"). OBTENER PRIMERO con gog_gmail_search.' },
        },
        required: ['id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Busca información actualizada en internet sobre cualquier tema. Útil para noticias, eventos recientes, o información que no está en tu conocimiento previo. Devuelve títulos, URLs y snippets de los resultados.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Término de búsqueda (ej. "noticias IA hoy", "resultado partido ayer")' },
          limit: { type: 'number', description: 'Número máximo de resultados (default: 5)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'news_search',
      description: 'Busca noticias recientes en internet sobre un tema específico. Filtra resultados para mostrar solo fuentes de noticias.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Término de búsqueda de noticias (ej. "elecciones España", "tecnología 2026")' },
          limit: { type: 'number', description: 'Número máximo de resultados (default: 5)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'youtube_transcript',
      description: 'Obtiene información y transcripción de un video de YouTube. NOTA: YouTube puede bloquear transcripciones desde servidor. La herramienta devuelve: título, descripción, idiomas disponibles y transcripción si está accesible. Úsalo para resumir contenido cuando la transcripción esté disponible.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL del video (ej: "https://youtube.com/watch?v=abc123") o ID (11 caracteres)' },
        },
        required: ['url'],
        additionalProperties: false,
      },
    },
  }
];

export const toolHandlers: Record<string, Function> = {
  get_current_time: () => {
    return new Date().toLocaleString('es-ES', { timeZone: 'America/Lima' }); // Cambiado a Lima por contexto anterior O a UTC
  },
  gog_gmail_search: ({ query }: { query: string }) => {
    const result = runGogCommand(['gmail', 'search', `"${query}"`, '--json']);

    // Si hay resultados, agregar nota explícita sobre el ID
    if (result.threads && result.threads.length > 0) {
      // Formatear para que el LLM vea claramente los IDs
      result._instruction = "USA EXACTAMENTE el campo 'id' de abajo para gog_gmail_get. Copia carácter por carácter sin modificar.";
      result._example = `Si usas gog_gmail_get, el ID debe ser idéntico, ej: "${result.threads[0].id}"`;
    }

    return result;
  },
  gog_gmail_get: ({ id }: { id: string }) => {
    // Validación estricta del ID (debe ser threadId de 16 caracteres hex)
    if (!id || !isValidGmailThreadId(id)) {
      console.error(`[GOG] ID inválido recibido: "${id}". Debe ser 16 caracteres hex.`);
      return {
        error: `ID de hilo inválido: "${id}". El ID debe tener exactamente 16 caracteres hexadecimales (ej: "19d30c9e56c058d4"). Copia el ID EXACTO de gog_gmail_search.`
      };
    }
    // El ID debe ser el "threadId" devuelto por gog_gmail_search
    const result = runGogCommand(['gmail', 'get', id, '--json']);

    // Si hay error 404, dar mensaje más útil
    if (result.error && result.error.includes('404 notFound')) {
      return {
        error: `No se encontró el correo con ID "${id}". Esto puede deberse a: (1) El ID fue copiado incorrectamente, (2) El correo fue borrado/movido. Solución: Ejecuta gog_gmail_search nuevamente y copia el ID EXACTO sin modificar ningún carácter.`,
        attemptedId: id
      };
    }

    return result;
  },
  gog_calendar_events: ({ from, to }: { from: string, to: string }) => {
    return runGogCommand(['calendar', 'events', 'primary', '--from', from, '--to', to, '--json']);
  },
  gog_sheets_get: ({ sheetId, range }: { sheetId: string, range: string }) => {
    return runGogCommand(['sheets', 'get', sheetId, `"${range}"`, '--json']);
  },
  web_search: ({ query, limit }: { query: string; limit?: number }) => {
    return webSearch(query, limit || 5);
  },
  news_search: ({ query, limit }: { query: string; limit?: number }) => {
    return newsSearch(query, limit || 5);
  },
  youtube_transcript: ({ url }: { url: string }) => {
    return getYouTubeTranscript(url);
  }
};

import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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
    .trim()
    .substring(0, 12000); // Límite de seguridad para modelos de 16k-32k context
}

// Helpers para ejecutar gog CLI
function runGogCommand(args: string[]): any {
  try {
    const gogPath = process.platform === 'win32' ? path.join(projectRoot, 'gog.exe') : 'gog';
    const cmd = `"${gogPath}" ${args.join(' ')}`;
    console.log(`Ejecutando: ${cmd}`);
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
    console.error(`Error en gog CLI: ${error.message}`);
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
      description: 'Obtiene el contenido completo (cuerpo, asunto, remitente, fecha) de un correo electrónico específico usando el ID del hilo de Gmail. IMPORTANTE: Usa el campo "id" devuelto por gog_gmail_search (no el messageId interno). Úsalo después de gog_gmail_search para leer el cuerpo completo del correo.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'El ID del hilo de Gmail (campo "id" de gog_gmail_search, ej: "19d1c57009c3ebd8")' },
        },
        required: ['id'],
      },
    },
  }
];

export const toolHandlers: Record<string, Function> = {
  get_current_time: () => {
    return new Date().toLocaleString('es-ES', { timeZone: 'America/Lima' }); // Cambiado a Lima por contexto anterior O a UTC
  },
  gog_gmail_search: ({ query }: { query: string }) => {
    return runGogCommand(['gmail', 'search', `"${query}"`, '--json']);
  },
  gog_gmail_get: ({ id }: { id: string }) => {
    // El ID debe ser el "threadId" devuelto por gog_gmail_search
    return runGogCommand(['gmail', 'get', id, '--json']);
  },
  gog_calendar_events: ({ from, to }: { from: string, to: string }) => {
    return runGogCommand(['calendar', 'events', 'primary', '--from', from, '--to', to, '--json']);
  },
  gog_sheets_get: ({ sheetId, range }: { sheetId: string, range: string }) => {
    return runGogCommand(['sheets', 'get', sheetId, `"${range}"`, '--json']);
  }
};

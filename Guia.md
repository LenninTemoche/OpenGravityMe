# Guía de OpenGravityMe: De Local a la Nube 🌌

Esta guía describe los pasos realizados en el proyecto desde su concepción en local hasta su migración completa a Firebase Cloud.

---

## 1. Configuración Inicial (Local)
Originalmente, el proyecto funcionaba con **SQLite**.
- **Motor**: Bun/Node.js + TSX.
- **Base de Datos**: `better-sqlite3` guardando `memory.db` en local.
- **Interface**: Telegram (grammy).
- **IA**: Groq SDK (Llama 3.3).

### Pasos iniciales realizados:
1. Creación del proyecto (`package.json`, `tsconfig.json`).
2. Configuración del bot en `@BotFather` de Telegram.
3. Creación de una whitelist de IDs de Telegram para acceso privado.
4. Implementación del `AgentLoop` (bucle de razonamiento con herramientas).

---

## 2. Migración a Firebase (Cloud)
Para que el agente tenga memoria persistente en cualquier lugar y no dependa de un archivo local, migramos a **Firebase Firestore**.

### Paso 2.1: Creación del Proyecto en Firebase
1. Entrar a [Firebase Console](https://console.firebase.google.com/).
2. Crear un nuevo proyecto (`opengravityme`).

### Paso 2.2: Generación de Credenciales (Service Account)
1. Ir a **Configuración del proyecto** > **Cuentas de servicio**.
2. Hacer clic en **Generar nueva clave privada**.
3. Se descarga un archivo `.json`. Se renombró a `service-account.json` y se colocó en la carpeta raíz del proyecto.
4. Se agregó a `.gitignore` para evitar que se suba a repositorios públicos.

### Paso 2.3: Configuración de la Base de Datos (Firestore)
1. Ir a la pestaña **Firestore Database** en la consola.
2. Hacer clic en **Crear base de datos**.
3. Seleccionar **Modo Producción** (o Modo Prueba).
4. **Reglas de Seguridad**: Para permitir la escritura inicial, se actualizaron las reglas:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true; // Cambiar a autenticación de admin sdk
       }
     }
   }
   ```
5. **Permisos IAM (Google Cloud)**: Se asignó el rol **"Usuario de Cloud Datastore"** al correo del service account en [IAM & Admin](https://console.cloud.google.com/iam-admin/iam) para evitar el error `PERMISSION_DENIED`.

### Paso 2.4: Indexación de la Base de Datos
Firestore requiere índices compuestos para consultas que combinan `where` y `orderBy`.
1. Al ejecutar el bot por primera vez con historial, Firestore arroja un error con un **link**.
2. Al hacer clic en ese link, Firebase crea el índice necesario para ordenar los mensajes por `timestamp`.

---

## 3. Implementación de Notas de Voz
Se dotó al agente de capacidad auditiva y verbal manteniéndolo gratuito y escalable.

### Paso 3.1: Speech-to-Text (Reconocimiento Audivitivo)
1. Telegram guarda las notas de voz en formato `.ogg`. El bot obtiene el enlace (`getFile`) y descarga el buffer.
2. Se implementó una llamada a la API de **Groq** usando el modelo `whisper-large-v3`, enviando el archivo de audio.
3. Groq devuelve la transcripción en milisegundos.

### Paso 3.2: Text-to-Speech (Respuesta Verbal)
1. Originalmente exploramos *Google Cloud TTS*, pero al requerir permisos de facturación incompatibles con una capa 100% gratuita, se descartó.
2. Se integró la librería open source `google-tts-api`, que usa la interfaz pública gratuita de Google Translate.
3. Al tener un límite de 200 caracteres, se utilizó la función `getAllAudioBase64`, que corta inteligentemente el texto en oraciones, procesa cada trozo y los une (`Buffer.concat`) devolviendo un audio consolidado de cualquier longitud.
4. El archivo final se envía a Telegram usando `InputFile` y se borran los archivos temporales generados en local.

---

## 4. IA Multimodal y Lectura de Documentos
Para empoderar al agente como asistente integral, se añadió la capacidad de "ver" y de leer documentos ofimáticos.

### Paso 4.1: Lectura de Imágenes (Vision)
1. Telegram agrupa las imágenes enviadas en distintas resoluciones. Nuestro bot (`message:photo`) toma la de mayor tamaño.
2. Descarga la imagen en crudo y la convierte de Buffer a base64.
3. Se actualizó la estructura interna en `AgentLoop` para enviar un arreglo multimodal compatible con la API de OpenAI/Groq/OpenRouter, inyectando la imagen codificada allí.
4. Dada la baja disponibilidad de modelos Llama Vision en Groq, la app depende del robusto sistema de `fallback` hacia `OpenRouter` configurado como `Gemini 2.0 Flash`, el cual procesa imágenes instantáneamente.

### Paso 4.2: Parseo de Documentos (PDF, Word, Excel)
Se instalaron librerías ligeras open-source ejecutadas puramente en Node para asegurar privacidad local y costo cero:
- **PDF**: `pdf-parse` (usando `createRequire` para soporte CJS) lee vectores a texto.
- **DOCX**: `mammoth` lo convierte limpiamente sacando el raw text.
- **XLSX**: `xlsx` (SheetJS) lee múltiples páginas tabuladas y las inyecta como CSV.
El archivo se descarga de Telegram, se intercepta en `message:document`, se parsea y se envía al texto maestro del agente como un mensaje larguísimo para su análisis íntegro.

---

## 5. Habilidades de Contexto (Google Workspace)
Se ha integrado de forma nativa el CLI en Go llamado `gog` para permitirle al asistente interactuar con tus datos directos de Google en tiempo real.

### Paso 5.1: Herramientas Conectadas
Se extrajo el control total de Gmail, Calendar y Sheets a través del `toolHandlers` (`src/tools/index.ts`):
1.  **Manejo Robusto**: Todos los comandos ejecutan `execSync` con grandes reservas de memoria (`10MB maxBuffer`) para extraer miles de correos sin colgar el hilo principal de NodeJS.
2.  **Rutas Seguras**: `gog.exe` fue incrustado localmente y el código detecta su ubicación automáticamente usando `import.meta.url`, haciendo la ejecución 100% independiente del directorio desde donde inicies el bot.

### Paso 5.2: Inyección de Lógica (Prompt System)
El prompt del sistema (`SYSTEM_PROMPT`) fue inyectado con las directrices *OpenClaw* de Workspace:
-   **Prioridad y Síntesis**: El agente resume hilos y resalta correos importantes (urgentes, finanzas, facturas).
-   **Briefing Matutino**: Al pedírselo, lee inteligentemente tus eventos de calendario (`gog_calendar_events`) y tus `is:unread` en Gmail para formular un reporte inicial.

### Paso 5.3: Habilitación de APIs en Google Cloud
Antes de poder extraer tus correos, necesitas indicarle a tu proyecto en Google Cloud qué herramientas de Workspace usarás.
1. Entra a tu proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Busca y navega a **"APIs y Servicios" > "Biblioteca" (Library)**.
3. Busca y habilita (clic en *Enable*) una por una las siguientes APIs:
   - **Gmail API** (Para leer correos)
   - **Google Calendar API** (Para leer eventos)
   - **Google Sheets API** (Para extraer hojas de cálculo)
   - **Google Docs API** y **Google Drive API** (Recomendadas para el ecosistema).

### Paso 5.4: Autenticación OAuth Local
Dado que el bot corre localmente, el agente se apalanca en las credenciales "Oauth Client ID (Desktop App)" de la Nube de Google descargadas en la raíz bajo el nombre `credentials.json`.
1. Primero registramos las credenciales en gog:
   ```bash
   .\gog auth credentials credentials.json
   ```
2. Luego autorizamos tu cuenta personal:
   ```bash
   .\gog auth add usuario@gmail.com --services gmail,calendar,drive,contacts,docs,sheets
   ```
 *(Nota: Si lanza Error 403, recuerda añadir tu email a "Test Users" en la Pantalla de Consentimiento de tu Google Cloud Console).*

---

## 6. Lectura de Correos - Implementación y Solución de Problemas

### Paso 6.1: Validación Estricta de IDs de Gmail

**Problema Identificado**: El modelo de IA estaba modificando los IDs de correo entre la búsqueda y la lectura, causando errores 404.

**Solución Implementada**:

1. **Función de Validación** (`src/tools/index.ts`):
   ```typescript
   function isValidGmailThreadId(id: string): boolean {
     return /^[a-f0-9]{16}$/i.test(id);
   }
   ```

2. **Handler de `gog_gmail_get` con Validación**:
   ```typescript
   gog_gmail_get: ({ id }: { id: string }) => {
     if (!id || !isValidGmailThreadId(id)) {
       return { 
         error: `ID inválido: "${id}". Debe ser 16 caracteres hexadecimales.`
       };
     }
     const result = runGogCommand(['gmail', 'get', id, '--json']);
     
     // Manejo de error 404
     if (result.error && result.error.includes('404 notFound')) {
       return {
         error: `No se encontró el correo con ID "${id}". 
         Copia el ID EXACTO de gog_gmail_search.`,
         attemptedId: id
       };
     }
     return result;
   }
   ```

3. **Instrucciones Explícitas en gog_gmail_search**:
   ```typescript
   gog_gmail_search: ({ query }: { query: string }) => {
     const result = runGogCommand(['gmail', 'search', `"${query}"`, '--json']);
     
     if (result.threads && result.threads.length > 0) {
       result._instruction = "USA EXACTAMENTE el campo 'id' para gog_gmail_get";
       result._example = `ID ejemplo: "${result.threads[0].id}"`;
     }
     return result;
   }
   ```

### Paso 6.2: SYSTEM_PROMPT Actualizado - Protocolo de Correos

Se añadió una sección específica en `src/agent/index.ts`:

```
=== PROTOCOLO DE LECTURA Y RESUMEN DE CORREOS (ESTRICTO) ===

1. **Búsqueda PRIMERO, lectura DESPUÉS:**
   - USA PRIMERO gog_gmail_search con la query apropiada
   - gog_gmail_search devuelve: id (16 caracteres hex), date, from, subject, snippet
   - NUNCA uses gog_gmail_get sin haber obtenido el ID primero
   - NUNCA inventes o adivines IDs

2. **COPIA EXACTA DEL ID (CRÍTICO):**
   - Ejemplo REAL: "19d30c9e56c058d4" (cada carácter cuenta)
   - ERROR COMÚN: Cambiar "19d30c9e56c058d4" por "19f1a7a86f4e1989" → Error 404
   - Si recibes error 404, verifica que copiaste el ID exactamente

3. **Resumen de múltiples correos:**
   - Presenta lista con: remitente, asunto y fecha
   - Pide al usuario que especifique cuál leer
   - Usa gog_gmail_get con el ID EXACTO
```

### Paso 6.3: Limpieza de Cuerpo de Correos

Función `cleanEmailBody()` mejorada:
```typescript
function cleanEmailBody(text: string): string {
  return text
    .replace(/<style([\s\S]*?)<\/style>/gi, '')
    .replace(/<script([\s\S]*?)<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .substring(0, 25000); // Límite aumentado
}
```

---

## 7. Smart Routing y Gestión de Tokens

### Paso 7.1: Optimización de max_tokens

**Problema**: Errores 402 (OpenRouter sin créditos) y 413 (Groq excede límite TPM).

**Solución** (`src/llm/service.ts`):

```typescript
// Función genérica con max_tokens configurable
async function callLLM(client, model, messages, tools, maxTokens = 2000) {
  // ...
  max_tokens: maxTokens
}

// Fallback con tokens reducidos
chatWithTools: async (messages, tools) => {
  // OpenRouter: 800-1000 tokens (evitar error 402)
  const response = await callLLM('openrouter', model, messages, tools, 1000);
  
  // Groq fallback: 1500 tokens (evitar límite 12000 TPM)
  const response = await callLLM('groq', config.GROQ_MODEL, messages, tools, 1500);
}
```

### Paso 7.2: Reducción de Historial

**Archivo**: `src/db/firestore.ts`
```typescript
getHistory: async (userId, limit = 10) => {
  // Antes: limit = 20
  // Ahora: limit = 10 para reducir tokens en contexto
}
```

### Paso 7.3: Truncamiento de Respuestas Largas

**Archivo**: `src/agent/index.ts`
```typescript
async run(userInput, base64Image, callback) {
  const history = await dbService.getHistory(this.userId, 10);
  
  // Truncar tool responses largas
  const truncatedHistory = history.map(msg => {
    if (msg.role === 'tool' && msg.content.length > 3000) {
      return { 
        ...msg, 
        content: msg.content.substring(0, 3000) + 
          '\n\n[...contenido truncado por límite de tokens...]' 
      };
    }
    return msg;
  });
}
```

### Paso 7.4: Configuración .env Actualizada

```env
# Modelos OpenRouter (principal y fallbacks)
OPENROUTER_MODEL="google/gemini-2.0-flash-001"
OPENROUTER_MODEL_SUMMARY="google/gemini-2.0-flash-001"
OPENROUTER_MODEL_LOGIC="deepseek/deepseek-chat"
OPENROUTER_MODEL_TECH="qwen/qwen-2.5-72b-instruct"

# Groq (fallback final)
GROQ_MODEL="llama-3.3-70b-versatile"
```

### Paso 7.5: Flujo de Fallback

```
Gemini 2.0 Flash (OpenRouter, 1000 tokens)
      ↓ (si falla: 402 o error)
DeepSeek Chat (OpenRouter, 800 tokens)
      ↓ (si falla)
Qwen 2.5 72B (OpenRouter, 1000 tokens)
      ↓ (si falla)
Groq Llama 3.3 (1500 tokens, fallback final)
```

---

## 8. Correcciones y Mejoras Realizadas

- **Bug de Respuesta Doble**: Se corrigió el flujo del `AgentLoop` para que solo envíe mensajes al usuario cuando la respuesta final de la IA esté lista.
- **Validación de IDs**: Implementada validación estricta de 16 caracteres hex para IDs de Gmail.
- **Manejo de Errores 404**: Mensajes claros cuando un correo no se encuentra.
- **Gestión de Tokens**: Historial reducido + truncamiento automático + max_tokens optimizados.
- **Logging Mejorado**: Tags `[LLM]`, `[GOG]`, `[Groq Error]` para depuración clara.
- **NodeNext**: `tsconfig.json` configurado para módulos ESM.

---

## 9. Cómo Mantener el Proyecto

Para futuras herramientas o mejoras:

1. **Agregar nuevas herramientas**:
   - Añádelas en `src/tools/index.ts` (definición + handler).
   - Actualiza `SYSTEM_PROMPT` si es necesario.

2. **Configurar modelos de IA**:
   - Edita las variables `OPENROUTER_MODEL_*` en `.env`.
   - El fallback está en `src/llm/service.ts`.

3. **Memoria y Conversaciones**:
   - Los datos se guardan en `messages` de Firestore.
   - La memoria a largo plazo (key-value) va en `memory`.

4. **Gestión de Tokens**:
   - Ajusta `max_tokens` en `llm/service.ts` según límites de tu plan.
   - Modifica el límite de historial en `db/firestore.ts`.
   - Cambia el límite de truncamiento en `agent/index.ts`.

5. **Depuración**:
   - Revisa la consola para ver qué modelo se está usando.
   - Los errores de rate limit activan el fallback automáticamente.
   - Usa `npm run build` para verificar errores de TypeScript.

---

## 10. Solución de Problemas Comunes

### Error 404 en gog_gmail_get
**Causa**: ID modificado o incorrecto.
**Solución**: Ejecuta `gog_gmail_search` nuevamente y copia el ID exacto sin cambiar ningún carácter.

### Error 402 en OpenRouter
**Causa**: Sin créditos suficientes.
**Solución**: 
1. Recarga créditos en https://openrouter.ai/settings/credits
2. O reduce `max_tokens` en `src/llm/service.ts`

### Error 413 en Groq (Rate Limit Exceeded)
**Causa**: Exceso de tokens por minuto (límite 12000 TPM en free).
**Solución**:
1. Reduce `max_tokens` a 1500 o menos.
2. Reduce historial a 10 mensajes.
3. Trunca respuestas de herramientas a 3000 chars.

### Error PERMISSION_DENIED en Firestore
**Causa**: Service account sin permisos IAM.
**Solución**: Asigna rol "Usuario de Cloud Datastore" en [IAM & Admin](https://console.cloud.google.com/iam-admin/iam).

---

## 11. Próximos Pasos y Mejoras Futuras 🚀

Aquí tienes una hoja de ruta con mejoras potenciales para continuar potenciando OpenGravityMe:

### 11.1 Mejoras para YouTube (Prioridad Alta)

**Problema Actual**: YouTube bloquea transcripciones desde servidor.

**Soluciones Propuestas**:

1. **Usar API de YouTube Data v3**:
   ```typescript
   // Requiere API Key de Google Cloud
   const youtube = google.youtube({ version: 'v3', auth: YOUTUBE_API_KEY });
   const captions = await youtube.captions.list({ /* ... */ });
   ```
   - Habilitar YouTube Data API v3 en Google Cloud
   - Usar OAuth 2.0 para acceso a transcripciones

2. **Servicio de Terceros**:
   - Integrar `youtube-transcript` (npm) con proxy rotativo
   - Usar servicios como `yt-dlp` vía subprocess

3. **Alternativa con Whisper**:
   - Descargar audio del video (si es posible legalmente)
   - Transcribir con Groq Whisper locally
   - Devolver transcripción + timestamps

### 11.2 Mejoras para Gmail (Prioridad Alta)

1. **Marcado de Correos como Leídos**:
   ```typescript
   gog_gmail_mark_read: ({ id }: { id: string }) => {
     return runGogCommand(['gmail', 'modify', id, '--remove', 'UNREAD', '--json']);
   }
   ```

2. **Enviar Correos**:
   ```typescript
   gog_gmail_send: ({ to, subject, body }: { to: string, subject: string, body: string }) => {
     return runGogCommand(['gmail', 'send', to, '--subject', subject, '--body', body]);
   }
   ```

3. **Búsqueda Avanzada con Filtros**:
   - Agregar parámetros: `from:`, `to:`, `after:`, `before:`, `has:attachment`
   - Paginación de resultados (nextPageToken)

4. **Adjuntos de Correos**:
   - Extraer y descargar archivos adjuntos
   - Procesar con documentService automáticamente

### 11.3 Mejoras de Memoria y Contexto (Prioridad Media)

1. **Memoria a Largo Plazo**:
   ```typescript
   // Guardar preferencias del usuario
   await dbService.setMemory('preferred_language', 'es');
   await dbService.setMemory('timezone', 'America/Lima');
   ```

2. **Resumen Automático de Conversaciones**:
   - Cada 20 mensajes, generar resumen con IA
   - Guardar resumen en memoria para contexto futuro

3. **Recordatorios Programados**:
   ```typescript
   // Usando node-cron o similar
   cron.schedule('0 8 * * *', async () => {
     await sendMorningBriefing(userId);
   });
   ```

### 11.4 Mejoras de Google Workspace (Prioridad Media)

1. **Google Drive**:
   - Listar archivos recientes
   - Buscar por nombre/tipo
   - Leer contenido de Docs directamente

2. **Google Tasks**:
   - Crear/leer tareas
   - Marcar como completadas
   - Integrar con recordatorios

3. **Google Contacts**:
   - Buscar contactos por nombre/email
   - Crear nuevos contactos

4. **Google Meet**:
   - Crear reuniones desde calendario
   - Enviar invitaciones automáticas

### 11.5 Mejoras de IA y Modelos (Prioridad Media)

1. **Modelos Locales con Ollama**:
   ```env
   OLLAMA_MODEL="llama3.1:8b"
   OLLAMA_BASE_URL="http://localhost:11434"
   ```
   - Fallback gratuito ilimitado
   - Privacidad total

2. **Embeddings para Búsqueda Semántica**:
   - Guardar embeddings de mensajes en Firestore
   - Búsqueda vectorial para contexto relevante

3. **Fine-tuning del Prompt**:
   - A/B testing de SYSTEM_PROMPT
   - Analizar logs para mejorar respuestas

### 11.6 Mejoras de Telegram Bot (Prioridad Baja)

1. **Comandos Personalizados**:
   ```typescript
   bot.command('briefing', (ctx) => sendMorningBriefing(ctx));
   bot.command('resumen', (ctx) => sendDailySummary(ctx));
   bot.command('ayuda', (ctx) => sendHelpMenu(ctx));
   ```

2. **Menús Inline**:
   - Botones para acciones rápidas
   - Menú de configuración

3. **Soporte para Grupos**:
   - Whitelist de grupos permitidos
   - Comandos específicos para grupos

### 11.7 Mejoras de Infraestructura (Prioridad Baja)

1. **Dockerización**:
   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   CMD ["node", "dist/index.js"]
   ```

2. **Deploy en la Nube**:
   - Railway.app (gratis con límites)
   - Render.com (free tier disponible)
   - Google Cloud Run (pago por uso)

3. **Monitoreo y Logs**:
   - Integrar con Sentry para errores
   - Logs estructurados con Winston
   - Dashboard de métricas

### 11.8 Características Avanzadas (Futuro)

1. **Soporte Multi-usuario**:
   - Base de datos separada por usuario
   - Configuración individual por usuario
   - Límites de uso por usuario

2. **Web Dashboard**:
   - React/Next.js para interfaz web
   - Ver historial de conversaciones
   - Configurar preferencias

3. **Integraciones Adicionales**:
   - Slack bot
   - Discord bot
   - API REST para terceros

4. **Análisis de Sentimientos**:
   - Detectar urgencia en correos
   - Priorizar por tono emocional

5. **Automatizaciones (IFTTT-style)**:
   ```
   SI correo de "jefe" con "urgente" ENTONCES → notificar por Telegram
   SI evento calendario en 30min ENTONCES → enviar recordatorio
   ```

---

## 12. Roadmap Sugerido

| Fase | Mejora | Complejidad | Impacto |
|------|--------|-------------|---------|
| 1 | YouTube transcripts (API oficial) | Media | Alto |
| 2 | Enviar correos Gmail | Baja | Alto |
| 3 | Marcar correos como leídos | Baja | Medio |
| 4 | Memorias a largo plazo | Media | Alto |
| 5 | Google Drive integration | Media | Medio |
| 6 | Dockerización | Baja | Medio |
| 7 | Web Dashboard | Alta | Bajo |
| 8 | Multi-usuario | Alta | Medio |

---

## 13. Recursos y Enlaces Útiles

- **Groq Console**: https://console.groq.com
- **OpenRouter**: https://openrouter.ai
- **Firebase Console**: https://console.firebase.google.com
- **Google Cloud Console**: https://console.cloud.google.com
- **Telegram Bot API**: https://core.telegram.org/bots/api
- **gog CLI**: https://github.com/derailed/gog
- **Documentación Oficial**:
  - [Grammy.js](https://grammy.dev)
  - [Groq SDK](https://github.com/groq/groq-typescript)
  - [Firebase Admin](https://firebase.google.com/docs/admin/setup)

---

*Última actualización: Marzo 2026*

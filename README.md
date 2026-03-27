# OpenGravityMe 🌌

Tu agente de IA personal, local, privado y seguro, ahora con memoria en la nube.

## Características
- **Telegram Bot**: Única interfaz para interactuar con tu agente.
- **Interacción por Voz 🎙️**: Envíale notas de voz y te responderá con audio. (Usa *Whisper* de Groq para STT súper rápido y *Google Translate TTS* gratis para síntesis).
- **IA Multimodal y Documental 👁️📄**: Sube imágenes para analizar visualmente (con backup vía OpenRouter) o envía documentos (PDF, DOCX, XLSX, TXT) para extraer y procesar su contenido al instante con utilidades locales gratuitas.
- **Asistente Avanzado (Google Workspace) 📧📅**: Integra el CLI `gog` para otorgar "Habilidades de Contexto" y buscar correos prioritarios, leer hilos completos, resumir agendas (Briefing Matutino) y validar tus hojas de Google Sheets con lógica autogestionada.
- **Lectura de Correos Completa**: Nueva herramienta `gog_gmail_get` que obtiene el cuerpo completo de correos usando el thread ID, con limpieza automática de HTML/CSS para optimizar el contexto.
- **Smart Routing de LLM**: Sistema de fallback inteligente: Gemini 2.5 Flash → Gemini 2.0 → DeepSeek → Qwen → Groq, configurable desde `.env`.
- **Memoria en la Nube**: Google Firebase (Firestore) para persistencia escalable.
- **Herramientas**: Capacidad de ejecutar funciones nativas, leer archivos y obtener fechas.
- **Seguridad**: Whitelist de IDs de Telegram y credenciales controlables en local.

## Requisitos
- Node.js v20+
- Telegram Bot Token (@BotFather)
- Groq API Key
- Cuenta de Firebase (Firestore activo)
- Google Cloud Project configurado (OAuth Credentials y APIs de Gmail/Calendar/Sheets habilitadas)

## Instalación

1. Clona el repositorio.
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. **Firebase Setup**:
   - Descarga tu `service-account.json` desde la consola de Firebase.
   - Colócalo en la raíz del proyecto.
4. Configura las variables de entorno en un archivo `.env`:
   ```env
   TELEGRAM_BOT_TOKEN="tu_token"
   TELEGRAM_ALLOWED_USER_IDS="tu_id"
   GROQ_API_KEY="tu_clave_groq"
   GROQ_MODEL="llama-3.3-70b-versatile"
   OPENROUTER_API_KEY="tu_clave_openrouter"
   OPENROUTER_MODEL="google/gemini-2.5-flash"
   OPENROUTER_MODEL_SUMMARY="google/gemini-2.0-flash-001"
   OPENROUTER_MODEL_LOGIC="deepseek/deepseek-chat"
   OPENROUTER_MODEL_TECH="qwen/qwen-2.5-72b-instruct"
   GOOGLE_APPLICATION_CREDENTIALS="./service-account.json"
   ```

## Ejecución

```bash
npm run dev
```

Para más detalles paso a paso, consulta [Guia.md](./Guia.md).

## Estructura del Proyecto
- `src/bot/`: Lógica del bot de Telegram (grammy).
- `src/agent/`: Bucle de razonamiento (AgentLoop) con SYSTEM_PROMPT.
- `src/db/`: Capa de persistencia en Firestore Cloud.
- `src/llm/`: Integración con Groq y OpenRouter (Smart Routing).
- `src/tools/`: Herramientas (funciones que la IA puede usar: gmail, calendar, sheets).
- `src/services/`: Servicios de audio (STT/TTS) y parseo de documentos.
- `src/config/`: Validación de entorno con Zod.

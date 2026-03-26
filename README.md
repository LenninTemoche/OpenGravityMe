# OpenGravityMe 🌌

Tu agente de IA personal, local, privado y seguro, ahora con memoria en la nube.

## Características
- **Telegram Bot**: Única interfaz para interactuar con tu agente.
- **Interacción por Voz 🎙️**: Envíale notas de voz y te responderá con audio. (Usa *Whisper* de Groq para STT súper rápido y *Google Translate TTS* gratis para síntesis).
- **IA Multimodal y Documental 👁️📄**: Sube imágenes para analizar visualmente (con backup vía OpenRouter) o envía documentos (PDF, DOCX, XLSX, TXT) para extraer y procesar su contenido al instante con utilidades locales gratuitas.
- **LLM Flexible**: Usa Groq (llama-3.3-70b) como motor principal y OpenRouter como respaldo.
- **Memoria en la Nube**: Google Firebase (Firestore) para persistencia escalable.
- **Herramientas**: Capacidad de ejecutar funciones locales (ej. `get_current_time`).
- **Seguridad**: Whitelist de IDs de Telegram y credenciales seguras.

## Requisitos
- Node.js v20+
- Telegram Bot Token (@BotFather)
- Groq API Key
- Cuenta de Firebase (Firestore activo)

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
   GOOGLE_APPLICATION_CREDENTIALS="./service-account.json"
   ```

## Ejecución

```bash
npm run dev
```

Para más detalles paso a paso, consulta [Guia.md](./Guia.md).

## Estructura del Proyecto
- `src/bot/`: Lógica del de Telegram (grammy).
- `src/agent/`: Bucle de razonamiento (AgentLoop).
- `src/db/`: Capa de persistencia en Firestore Cloud.
- `src/llm/`: Integración con Groq y OpenRouter.
- `src/tools/`: Herramientas (funciones que la IA puede usar).
- `src/config/`: Validación de entorno con Zod.

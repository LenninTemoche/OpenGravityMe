# OpenGravityMe 🌌

Tu agente de IA personal, local, privado y seguro.

## Características
- **Telegram Bot**: Única interfaz para interactuar con tu agente.
- **LLM Flexible**: Usa Groq (llama-3.3-70b) como motor principal y OpenRouter como respaldo.
- **Memoria Persistente**: SQLite para recordar conversaciones anteriores.
- **Herramientas**: Capacidad de ejecutar funciones locales (ej. `get_current_time`).
- **Seguridad**: Whitelist de IDs de Telegram para acceso privado.

## Requisitos
- Node.js v20+
- Telegram Bot Token (@BotFather)
- Groq API Key

## Instalación

1. Clona el repositorio.
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Configura las variables de entorno en un archivo `.env` (usa `.env.example` como base):
   ```env
   TELEGRAM_BOT_TOKEN="tu_token"
   TELEGRAM_ALLOWED_USER_IDS="tu_id,otro_id"
   GROQ_API_KEY="tu_clave_groq"
   ```

## Ejecución

En desarrollo (con hot-reload):
```bash
npm run dev
```

En producción:
```bash
npm run build
npm start
```

## Estructura del Proyecto
- `src/bot/`: Lógica del bot de Telegram (grammy).
- `src/agent/`: Bucle de razonamiento del agente.
- `src/llm/`: Integración con APIs de modelos de lenguaje.
- `src/tools/`: Herramientas disponibles para el agente.
- `src/db/`: Capa de persistencia (SQLite).
- `src/config/`: Validación de variables de entorno.

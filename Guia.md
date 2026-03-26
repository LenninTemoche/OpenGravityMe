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
4. Dada la baja disponibilidad de modelos Llama Vision en Groq, la app depende del robusto sistema de `fallback` hacia `OpenRouter` configurado como `Gemini 2.5 Flash`, el cual procesa imágenes instantáneamente.

### Paso 4.2: Parseo de Documentos (PDF, Word, Excel)
Se instalaron librerías ligeras open-source ejecutadas puramente en Node para asegurar privacidad local y costo cero:
- **PDF**: `pdf-parse` (usando `createRequire` para soporte CJS) lee vectores a texto.
- **DOCX**: `mammoth` lo convierte limpiamente sacando el raw text.
- **XLSX**: `xlsx` (SheetJS) lee múltiples páginas tabuladas y las inyecta como CSV.
El archivo se descarga de Telegram, se intercepta en `message:document`, se parsea y se envía al texto maestro del agente como un mensaje larguísimo para su análisis íntegro.

---

## 5. Correcciones Realizadas

- **Bug de Respuesta Doble**: Se corrigió el flujo del `AgentLoop` para que solo envíe mensajes al usuario cuando la respuesta final de la IA esté lista (evitando enviar texto intermedio cuando aún va a llamar a una herramienta).
- **Prompt System**: Se reforzó el prompt del sistema para evitar que el modelo alucine etiquetas de texto como `<function=...>` y use la interfaz de herramientas oficial.
- **NodeNext**: Se ajustó `tsconfig.json` a `NodeNext` para manejar correctamente las importaciones de módulos ESM (`.js`).

---

## 6. Cómo Mantener el Proyecto
Para futuras herramientas:
1. Agrégalas en `src/tools/index.ts`.
2. Los datos de la conversación se guardan automáticamente en la colección `messages` de Firestore.
3. La "memoria a largo plazo" (key-value) se guarda en la colección `memory`.

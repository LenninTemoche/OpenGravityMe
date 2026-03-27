import { Bot, InputFile } from 'grammy';
import { config } from '../config/index.js';
import { AgentLoop } from '../agent/index.js';
import { audioService } from '../services/audio.js';
import fs from 'fs';
import path from 'path';

export const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

// Límite de caracteres de Telegram por mensaje
const TELEGRAM_MESSAGE_LIMIT = 4000;

/**
 * Envía un mensaje largo dividiéndolo en múltiples partes si es necesario
 */
async function sendLongMessage(ctx: any, text: string): Promise<void> {
  if (text.length <= TELEGRAM_MESSAGE_LIMIT) {
    await ctx.reply(text);
    return;
  }

  // Dividir el texto en partes
  const parts: string[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    // Tomar un chunk del tamaño máximo
    let chunk = text.substring(currentIndex, currentIndex + TELEGRAM_MESSAGE_LIMIT);

    // Intentar cortar en un punto natural (punto final, newline)
    if (currentIndex + TELEGRAM_MESSAGE_LIMIT < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const cutPoint = Math.max(lastPeriod, lastNewline);

      if (cutPoint > TELEGRAM_MESSAGE_LIMIT / 2) {
        chunk = chunk.substring(0, cutPoint + 1);
      }
    }

    parts.push(chunk);
    currentIndex += chunk.length;
  }

  // Enviar cada parte con indicador de continuación
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;

    // Añadir indicador de continuación si no es el último
    const message = parts.length > 1 && !isLast
      ? `${part}\n\n_(continúa...)_`
      : part;

    await ctx.reply(message, { parse_mode: 'Markdown' });

    // Pequeña pausa entre mensajes para evitar rate limit
    if (!isLast) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

// Whitelist Middleware
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id.toString();
  if (!userId || !config.TELEGRAM_ALLOWED_USER_IDS.includes(userId)) {
    console.warn(`Unauthorized access attempt from ID: ${userId}`);
    if (ctx.from) {
        await ctx.reply('No tienes permiso para usar este bot.');
    }
    return;
  }
  await next();
});

bot.command('start', (ctx) => ctx.reply('¡Hola! Soy OpenGravity, tu asistente personal. Puedes enviarme texto o notas de voz. ¿En qué puedo ayudarte hoy?'));

import { documentService } from '../services/document.js';

// Handler for Voice Messages
bot.on('message:voice', async (ctx) => {
  const userId = ctx.from.id.toString();
  
  try {
    await ctx.replyWithChatAction('record_voice');
    
    // 1. Download voice file from Telegram
    const file = await ctx.getFile();
    const filePath = path.join(process.cwd(), `tmp_${userId}_voice.ogg`);
    const fileUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    
    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // 2. Transcribe with Groq Whisper
    const transcript = await audioService.transcribe(filePath);
    console.log(`Transcripción: ${transcript}`);

    // Clean up received file
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // 3. Process with Agent
    const agent = new AgentLoop(userId);
    await agent.run(transcript, undefined, async (responseText: string) => {
      try {
        // 4. Generate audio response (TTS)
        await ctx.replyWithChatAction('record_voice');
        const audioPath = await audioService.synthesize(responseText);

        // 5. Reply with Voice
        await ctx.replyWithVoice(new InputFile(audioPath));

        // Clean up generated audio
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      } catch (ttsError) {
        console.error('TTS failed, falling back to text:', ttsError);
        // Fallback to text if TTS fails
        await sendLongMessage(ctx, responseText);
      }
    });

  } catch (error) {
    console.error('Error processing voice message:', error);
    await ctx.reply('Lo siento, tuve un problema procesando tu nota de voz.');
  }
});

// Handler for Documents (PDF, Word, TXT, Excel)
bot.on('message:document', async (ctx) => {
  const userId = ctx.from.id.toString();
  const doc = ctx.message.document;

  if (!doc.file_name) {
    await ctx.reply('No pude identificar el archivo.');
    return;
  }

  try {
    await ctx.replyWithChatAction('typing');

    // 1. Download Document
    const file = await ctx.getFile();
    const filePath = path.join(process.cwd(), `tmp_${userId}_${doc.file_name}`);
    const fileUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    
    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // 2. Extract Text
    const extractedText = await documentService.extractText(filePath, doc.file_name);
    
    // Clean up received file right away
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // Prompt context wrapper
    const textPrompt = `He subido este documento llamado "${doc.file_name}". Aquí está su contenido de texto extraído:\n\n---\n${extractedText.substring(0, 50000)}\n---\n\n(Puedes analizar el documento basándote en este texto y si hay un caption en mi archivo es el siguiente: ${ctx.message.caption || 'Ninguno'})`;

    // 3. Process with Agent
    const agent = new AgentLoop(userId);
    await agent.run(textPrompt, undefined, async (responseText: string) => {
      await sendLongMessage(ctx, responseText);
    });

  } catch (error: any) {
    console.error('Error processing document message:', error);
    await ctx.reply(error.message || 'Lo siento, tuve un problema leyendo tu documento.');
  }
});

// Handler for Photos (Vision)
bot.on('message:photo', async (ctx) => {
  const userId = ctx.from.id.toString();
  // Telegram sends an array of photos with different resolutions. Get the best one (last).
  const photo = ctx.message.photo[ctx.message.photo.length - 1];

  try {
    await ctx.replyWithChatAction('typing');

    // 1. Download Photo
    const file = await ctx.getFile();
    const filePath = path.join(process.cwd(), `tmp_${userId}_photo.jpg`);
    const fileUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    
    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    // Directly convert to base64
    const base64Image = buffer.toString('base64');

    const promptText = ctx.message.caption || 'He subido esta imagen. ¿Qué puedes decirme sobre ella?';

    // 2. Process with Agent (passing base64 image)
    const agent = new AgentLoop(userId);
    await agent.run(promptText, base64Image, async (responseText: string) => {
      await sendLongMessage(ctx, responseText);
    });

  } catch (error: any) {
    console.error('Error processing photo message:', error);
    await ctx.reply('Lo siento, tuve un problema viendo tu foto.');
  }
});

// Handler for Text Messages
bot.on('message:text', async (ctx) => {
  const userId = ctx.from.id.toString();
  const text = ctx.message.text;

  // Show typing status
  await ctx.replyWithChatAction('typing');

  const agent = new AgentLoop(userId);
  try {
    await agent.run(text, undefined, async (responseText: string) => {
      await sendLongMessage(ctx, responseText);
    });
  } catch (error) {
    console.error('Error in agent loop:', error);
    await ctx.reply('Ocurrió un error inesperado al procesar tu mensaje.');
  }
});

export const startBot = () => {
  console.log('Starting Telegram Bot (Long Polling)...');
  bot.start({
    onStart: (botInfo) => {
      console.log(`Bot initialized as @${botInfo.username}`);
    },
  });
};

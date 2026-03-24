import { Bot, InputFile } from 'grammy';
import { config } from '../config/index.js';
import { AgentLoop } from '../agent/index.js';
import { audioService } from '../services/audio.js';
import fs from 'fs';
import path from 'path';

export const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

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
    await agent.run(transcript, async (responseText) => {
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
        await ctx.reply(responseText);
      }
    });

  } catch (error) {
    console.error('Error processing voice message:', error);
    await ctx.reply('Lo siento, tuve un problema procesando tu nota de voz.');
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
    await agent.run(text, async (responseText) => {
      await ctx.reply(responseText);
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

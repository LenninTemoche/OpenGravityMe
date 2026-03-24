import { Bot } from 'grammy';
import { config } from '../config/index.js';
import { AgentLoop } from '../agent/index.js';

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

bot.command('start', (ctx) => ctx.reply('¡Hola! Soy OpenGravity, tu asistente personal. ¿En qué puedo ayudarte hoy?'));

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

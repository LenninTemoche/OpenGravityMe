import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_ALLOWED_USER_IDS: z.string().transform((val) => val.split(',').map(id => id.trim())),
  GROQ_API_KEY: z.string(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('openrouter/free'),
  DB_PATH: z.string().default('./memory.db'),
});

export const config = envSchema.parse(process.env);

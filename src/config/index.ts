import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_ALLOWED_USER_IDS: z.string().transform((val) => val.split(',').map(id => id.trim())),
  GROQ_API_KEY: z.string(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('google/gemini-2.0-flash-001'),
  OPENROUTER_MODEL_SUMMARY: z.string().default('google/gemini-2.0-flash-001'),
  OPENROUTER_MODEL_LOGIC: z.string().default('deepseek/deepseek-chat'),
  OPENROUTER_MODEL_TECH: z.string().default('qwen/qwen-2.5-72b-instruct'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().default('./service-account.json'),
});

export const config = envSchema.parse(process.env);

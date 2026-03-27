import { Groq } from 'groq-sdk';
import OpenAI from 'openai';
import { config } from '../config/index.js';
import { Message } from '../db/firestore.js';

const groq = new Groq({ apiKey: config.GROQ_API_KEY });
const openRouter = config.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: config.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1'
    })
  : null;

// Llamada genérica a LLM con modelo específico
async function callLLM(client: 'openrouter' | 'groq', model: string, messages: any[], tools?: any[], maxTokens: number = 2000) {
  if (client === 'openrouter') {
    if (!openRouter) throw new Error('OpenRouter not configured');
    const options: any = {
      model,
      messages,
      max_tokens: maxTokens,
    };
    if (tools) {
      options.tools = tools;
      options.tool_choice = 'auto';
    }
    const response = await openRouter.chat.completions.create(options);
    return response.choices[0]?.message;
  } else {
    const options: any = {
      model,
      messages,
      max_tokens: maxTokens,
    };
    if (tools) {
      options.tools = tools;
      options.tool_choice = 'auto';
    }
    const response = await groq.chat.completions.create(options);
    return response.choices[0]?.message;
  }
}

export const llmService = {
  async chat(messages: Message[]): Promise<string> {
    // Primary: Groq (velocidad), Fallback: OpenRouter
    try {
      const response = await groq.chat.completions.create({
        model: config.GROQ_MODEL,
        messages: messages as any,
        max_tokens: 2000,
      });
      return response.choices[0]?.message?.content || 'No response from Groq';
    } catch (error: any) {
      console.error(`[Groq Error] ${config.GROQ_MODEL}:`, error.message);
      if (openRouter) {
        console.log('[LLM] Falling back to OpenRouter...');
        const response = await openRouter.chat.completions.create({
          model: config.OPENROUTER_MODEL,
          messages: messages as any,
          max_tokens: 1000, // Reducido para evitar error 402
        });
        return response.choices[0]?.message?.content || 'No response from OpenRouter';
      }
      throw error;
    }
  },

  async chatWithTools(messages: Message[], tools: any[]): Promise<any> {
    // Smart Routing: OpenRouter (Gemini 2.0 Flash) -> DeepSeek -> Qwen -> Groq
    if (openRouter) {
      // Intento 1: Gemini 2.0 Flash (modelo principal) - max_tokens reducido
      try {
        console.log(`[LLM] Using OpenRouter: ${config.OPENROUTER_MODEL}...`);
        const response = await callLLM('openrouter', config.OPENROUTER_MODEL, messages as any, tools, 1000);
        if (response) return response;
        throw new Error('Empty response from model');
      } catch (error: any) {
        console.warn(`[LLM] ${config.OPENROUTER_MODEL} failed: ${error.message}, trying ${config.OPENROUTER_MODEL_LOGIC}...`);

        // Intento 2: DeepSeek (razonamiento) - max_tokens reducido
        try {
          const response = await callLLM('openrouter', config.OPENROUTER_MODEL_LOGIC, messages as any, tools, 800);
          if (response) return response;
          throw new Error('Empty response from model');
        } catch (error2: any) {
          console.warn(`[LLM] ${config.OPENROUTER_MODEL_LOGIC} failed: ${error2.message}, trying ${config.OPENROUTER_MODEL_TECH}...`);

          // Intento 3: Qwen (técnico) - max_tokens reducido
          try {
            const response = await callLLM('openrouter', config.OPENROUTER_MODEL_TECH, messages as any, tools, 1000);
            if (response) return response;
            throw new Error('Empty response from model');
          } catch (error3: any) {
            console.warn(`[LLM] ${config.OPENROUTER_MODEL_TECH} failed: ${error3.message}, falling back to Groq...`);
          }
        }
      }
    }

    // Fallback final: Groq (cuando OpenRouter no está disponible o falla)
    try {
      console.log(`[LLM] Using Groq fallback: ${config.GROQ_MODEL}...`);
      // Reducir max_tokens para evitar límite TPM
      const response = await callLLM('groq', config.GROQ_MODEL, messages as any, tools, 1500);
      if (!response) throw new Error('Empty response from Groq');
      return response;
    } catch (error: any) {
      console.error('[LLM] All models failed:', error.message);
      throw new Error(`Servicio de IA no disponible: ${error.message}`);
    }
  }
};

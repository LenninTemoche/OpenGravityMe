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
async function callLLM(client: 'openrouter' | 'groq', model: string, messages: any[], tools?: any[]) {
  if (client === 'openrouter') {
    if (!openRouter) throw new Error('OpenRouter not configured');
    const options: any = {
      model,
      messages,
      max_tokens: 4000,
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
      max_tokens: 4000,
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
        max_tokens: 4000,
      });
      return response.choices[0]?.message?.content || 'No response from Groq';
    } catch (error) {
      console.error('Groq Error:', error);
      if (openRouter) {
        console.log('Falling back to OpenRouter...');
        const response = await openRouter.chat.completions.create({
          model: config.OPENROUTER_MODEL,
          messages: messages as any,
          max_tokens: 4000,
        });
        return response.choices[0]?.message?.content || 'No response from OpenRouter';
      }
      throw error;
    }
  },

  async chatWithTools(messages: Message[], tools: any[]): Promise<any> {
    // Smart Routing: OpenRouter (Gemini 2.5 Flash) -> DeepSeek -> Qwen -> Groq
    if (openRouter) {
      // Intento 1: Gemini 2.5 Flash (modelo principal del .env)
      try {
        console.log(`Using OpenRouter with ${config.OPENROUTER_MODEL}...`);
        const response = await callLLM('openrouter', config.OPENROUTER_MODEL, messages as any, tools);
        return response;
      } catch (error: any) {
        console.warn(`${config.OPENROUTER_MODEL} failed, trying ${config.OPENROUTER_MODEL_SUMMARY}...`);

        // Intento 2: Gemini 2.0 Flash (resúmenes)
        try {
          const response = await callLLM('openrouter', config.OPENROUTER_MODEL_SUMMARY, messages as any, tools);
          return response;
        } catch (error2: any) {
          console.warn(`${config.OPENROUTER_MODEL_SUMMARY} failed, trying ${config.OPENROUTER_MODEL_LOGIC}...`);

          // Intento 3: DeepSeek (razonamiento)
          try {
            const response = await callLLM('openrouter', config.OPENROUTER_MODEL_LOGIC, messages as any, tools);
            return response;
          } catch (error3: any) {
            console.warn(`${config.OPENROUTER_MODEL_LOGIC} failed, trying ${config.OPENROUTER_MODEL_TECH}...`);

            // Intento 4: Qwen (técnico)
            try {
              const response = await callLLM('openrouter', config.OPENROUTER_MODEL_TECH, messages as any, tools);
              return response;
            } catch (error4: any) {
              console.warn(`${config.OPENROUTER_MODEL_TECH} failed, falling back to Groq...`);
            }
          }
        }
      }
    }

    // Fallback final: Groq (cuando OpenRouter no está disponible o falla)
    try {
      console.log(`Using Groq as fallback with ${config.GROQ_MODEL}...`);
      const response = await callLLM('groq', config.GROQ_MODEL, messages as any, tools);
      return response;
    } catch (error) {
      console.error('Groq Tool Error:', error);
      throw error;
    }
  }
};

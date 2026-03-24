import { Groq } from 'groq-sdk';
import OpenAI from 'openai';
import { config } from '../config/index.js';
import { Message } from '../db/sqlite.js';

const groq = new Groq({ apiKey: config.GROQ_API_KEY });
const openRouter = config.OPENROUTER_API_KEY 
  ? new OpenAI({ 
      apiKey: config.OPENROUTER_API_KEY, 
      baseURL: 'https://openrouter.ai/api/v1' 
    }) 
  : null;

export const llmService = {
  async chat(messages: Message[]): Promise<string> {
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
    try {
      const response = await groq.chat.completions.create({
        model: config.GROQ_MODEL,
        messages: messages as any,
        tools: tools,
        tool_choice: 'auto',
        max_tokens: 4000,
      });
      return response.choices[0]?.message;
    } catch (error) {
       console.error('Groq Tool Error:', error);
       if (openRouter) {
         console.log('Falling back to OpenRouter for tools...');
         const response = await openRouter.chat.completions.create({
           model: config.OPENROUTER_MODEL,
           messages: messages as any,
           tools: tools,
           tool_choice: 'auto',
           max_tokens: 4000,
         });
         return response.choices[0]?.message;
       }
       throw error;
    }
  }
};

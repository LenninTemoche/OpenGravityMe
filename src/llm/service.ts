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
        model: 'llama-3.3-70b-specdec',
        messages: messages as any,
      });
      return response.choices[0]?.message?.content || 'No response from Groq';
    } catch (error) {
      console.error('Groq Error:', error);
      if (openRouter) {
        console.log('Falling back to OpenRouter...');
        const response = await openRouter.chat.completions.create({
          model: config.OPENROUTER_MODEL,
          messages: messages as any,
        });
        return response.choices[0]?.message?.content || 'No response from OpenRouter';
      }
      throw error;
    }
  },

  async chatWithTools(messages: Message[], tools: any[]): Promise<any> {
    try {
      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-specdec',
        messages: messages as any,
        tools: tools,
        tool_choice: 'auto',
      });
      return response.choices[0]?.message;
    } catch (error) {
       console.error('Groq Tool Error:', error);
       // Fallback for tools could be more complex, keeping it simple for now
       throw error;
    }
  }
};

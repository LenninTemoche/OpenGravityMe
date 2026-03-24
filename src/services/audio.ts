import { Groq } from 'groq-sdk';
import * as googleTTS from 'google-tts-api';
import { config } from '../config/index.js';
import fs from 'fs';
import path from 'path';

const groq = new Groq({ apiKey: config.GROQ_API_KEY });

export const audioService = {
  /**
   * Transcribe an audio file using Groq Whisper.
   */
  async transcribe(filePath: string): Promise<string> {
    try {
      const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-large-v3',
        prompt: 'La conversación es en español.',
        language: 'es',
        response_format: 'json',
      });
      return transcription.text;
    } catch (error) {
      console.error('Error in Groq transcription:', error);
      throw error;
    }
  },

  /**
   * Synthesize text to speech using Free Google TTS (Community).
   * Supports unlimited text length by automatically chunking the request.
   */
  async synthesize(text: string): Promise<string> {
    const tempFilePath = path.join(process.cwd(), 'tmp_response.mp3');
    
    try {
      // Use getAllAudioBase64 to handle text longer than 200 characters
      const audioChunks = await googleTTS.getAllAudioBase64(text, {
        lang: 'es', // "es-US" a veces no existe en esta API gratuita, usamos el general
        slow: false,
        host: 'https://translate.google.com',
        splitPunct: ',.?', // Divide el texto en signos de puntuación
      });

      // Combine all base64 chunks into a single Array representation
      const buffers = audioChunks.map((chunk) => Buffer.from(chunk.base64, 'base64'));
      const combinedBuffer = Buffer.concat(buffers);
      
      fs.writeFileSync(tempFilePath, combinedBuffer);
      
      return tempFilePath;
    } catch (error) {
      console.error('Error in FREE Google TTS:', error);
      throw error;
    }
  },
};

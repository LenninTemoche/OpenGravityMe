import * as dotenv from 'dotenv';
import { Groq } from 'groq-sdk';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
groq.models.list().then(m => {
  const models = m.data.map(model => model.id);
  console.log(models);
}).catch(console.error);

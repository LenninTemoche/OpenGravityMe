require('dotenv').config();
const { Groq } = require('groq-sdk');
const groq = new Groq();
groq.models.list().then(m => console.log(m.data.map(model => model.id))).catch(console.error);

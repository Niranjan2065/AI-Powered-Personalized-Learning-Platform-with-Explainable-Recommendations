// config/groq.js
const Groq = require("groq-sdk");

if (!process.env.GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY is not set in .env");
  process.exit(1);
}

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
module.exports = client;
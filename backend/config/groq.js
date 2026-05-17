// config/groq.js — Graceful Groq client with fallback
let client = null;

if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'gsk_your_groq_api_key_here') {
  try {
    const Groq = require('groq-sdk');
    client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    console.log('✅ Groq AI client initialized');
  } catch (e) {
    console.warn('⚠️  Groq SDK not available:', e.message);
  }
} else {
  console.warn('⚠️  GROQ_API_KEY not configured — AI quiz generation will use fallback mode');
}

module.exports = client;
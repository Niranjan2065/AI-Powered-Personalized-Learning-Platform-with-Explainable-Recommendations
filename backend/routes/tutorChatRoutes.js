// routes/tutorChatRoutes.js — AI Chat Tutor (Groq-powered)
const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many chat requests. Wait a moment.' },
  validate: { xForwardedForHeader: false },
});

// POST /api/tutor-chat
// Body: { messages, subjectContext, subject }
router.post('/', protect, authorize('student'), chatLimiter, async (req, res) => {
  const groqClient = require('../config/groq');
  const { messages = [], subjectContext = '', subject = 'General' } = req.body;

  if (!messages.length) {
    return res.status(400).json({ success: false, message: 'No messages provided.' });
  }

  const systemPrompt = `You are Aria, an empathetic AI learning tutor for a personalized education platform.
You specialize in explainable AI recommendations — helping students understand WHY they underperformed and HOW to improve.

Student context: ${subjectContext || `Asking about ${subject}`}
Subject: ${subject}

Your response rules:
- Be warm, encouraging, never judgmental
- When explaining failures, always use this structure:
  🔍 Why you failed: (specific root cause — name the exact concept)
  ✅ How to fix: (2-3 concrete, actionable bullet points)
  💡 Pro tip: (one memorable learning hack or mnemonic)
- Keep total response under 200 words
- Use simple language and analogies
- Always end with an encouraging note`;

  // --- Use Groq if available ---
  if (groqClient) {
    try {
      const completion = await groqClient.chat.completions.create({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: 500,
        temperature: 0.7,
      });
      const reply = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
      return res.json({ success: true, reply });
    } catch (err) {
      console.error('Groq error:', err.message);
      // Fall through to fallback
    }
  }

  // --- Fallback: rule-based response when Groq is not configured ---
  const score = parseFloat((subjectContext.match(/(\d+)%/) || [])[1]) || 0;
  let reply;
  if (score < 50) {
    reply = `🔍 Why you failed: The core concepts in ${subject} weren't fully understood yet — this is normal at this stage!\n\n✅ How to fix:\n• Re-read the lesson notes from the beginning\n• Watch a short YouTube explainer on the topic\n• Attempt 5 practice questions daily for one week\n\n💡 Pro tip: Teach the concept out loud to yourself — if you can't explain it simply, revisit it. You've got this! 💪`;
  } else if (score < 70) {
    reply = `🔍 Why you failed: You understand the basics but struggled with application questions in ${subject}.\n\n✅ How to fix:\n• Focus on worked examples, not just theory\n• Try past paper questions on your weak topics\n• Create a summary cheat-sheet of key formulas\n\n💡 Pro tip: Space your practice — 20 mins daily beats 2 hours once a week. Keep going! 🚀`;
  } else {
    reply = `🔍 Why you failed: Minor gaps in ${subject} — you're actually doing well overall!\n\n✅ How to fix:\n• Identify the 1-2 specific questions you missed\n• Review only those concepts, not the whole topic\n• Do one timed practice run before the next quiz\n\n💡 Pro tip: At your level, targeted review beats general revision every time. Almost there! ⭐`;
  }

  res.json({ success: true, reply, fallback: true });
});

module.exports = router;
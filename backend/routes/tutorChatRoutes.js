// routes/tutorChatRoutes.js — AI Chat Tutor (Groq-powered) v2
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
router.post('/', protect, authorize('student'), chatLimiter, async (req, res) => {
  const groqClient = require('../config/groq');
  const {
    messages        = [],
    subjectContext  = '',
    subject         = 'General',
    score           = null,
    quizTitle       = '',
  } = req.body;

  if (!messages.length) {
    return res.status(400).json({ success: false, message: 'No messages provided.' });
  }

  const scoreNum = parseFloat(score) || 0;
  const titleStr = quizTitle && quizTitle !== 'Quiz' ? `"${quizTitle}"` : 'this quiz';
  const scoreLine = score !== null
    ? `The student just scored ${Math.round(scoreNum)}% on ${titleStr}. ${scoreNum < 50 ? 'They failed.' : scoreNum < 70 ? 'They narrowly failed / borderline.' : 'They passed.'}`
    : '';

  const systemPrompt = `You are Aria, an empathetic AI learning tutor on a personalized education platform.
You help students understand exactly WHY they underperformed and HOW to fix it — with warmth, never judgment.

${scoreLine}
${subjectContext}

RESPONSE FORMAT — always use these three labelled sections:
🔍 Why you failed: [specific root cause — name the exact concept or skill gap, 1-2 sentences]
✅ How to fix:
• [concrete step 1]
• [concrete step 2]
• [concrete step 3]
💡 Pro tip: [one memorable trick, mnemonic, or habit — keep it short]

End with one short encouraging sentence.
Total response: under 180 words. Simple language. No filler phrases.`;

  // ── Try Groq ──
  if (groqClient) {
    try {
      const completion = await groqClient.chat.completions.create({
        model:       'llama3-8b-8192',
        messages:    [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens:  500,
        temperature: 0.65,
      });
      const reply = completion.choices[0]?.message?.content || 'Sorry, no response generated.';
      return res.json({ success: true, reply });
    } catch (err) {
      console.error('Groq error:', err.message);
      // fall through to smart fallback
    }
  }

  // ── Smart rule-based fallback (no Groq key) ──
  const topicName = subject && subject !== 'General' && subject !== 'Quiz' ? subject : 'this topic';
  let reply;
  if (scoreNum < 50) {
    reply = `🔍 Why you failed: The foundational concepts in ${topicName} weren't firmly in place yet — you need to rebuild from the basics before attempting harder questions.\n\n✅ How to fix:\n• Go back to the first lesson and re-read it actively (take notes)\n• Watch one short YouTube explainer on the specific concept you struggled with\n• Do 5 practice questions per day for one week — consistency beats cramming\n\n💡 Pro tip: Teach the concept out loud to yourself — if you can't explain it simply, that's exactly where to focus.\n\nYou've identified the gap — that's the hardest step. You've got this! 💪`;
  } else if (scoreNum < 70) {
    reply = `🔍 Why you failed: You understand the basics of ${topicName} but struggled to apply them under quiz conditions — a gap between knowing and doing.\n\n✅ How to fix:\n• Work through 3-5 worked examples (not just reading theory)\n• Identify the specific question types you got wrong and drill those\n• Create a one-page summary sheet of key rules and formulas\n\n💡 Pro tip: Space your revision — 20 minutes daily beats 2 hours the night before.\n\nYou're close — one focused revision session could flip this to a pass. Keep going! 🚀`;
  } else {
    reply = `🔍 Why you failed: Minor knowledge gaps in ${topicName} — you passed the basics but lost marks on the trickier application questions.\n\n✅ How to fix:\n• Review only the specific questions you got wrong (not the whole topic)\n• Focus on the edge cases and exceptions, not the core rules you already know\n• Do one timed practice under exam conditions before retrying\n\n💡 Pro tip: At your level, targeted gap-filling beats general revision every time.\n\nYou're very close to mastery — a small push will get you there. ⭐`;
  }

  res.json({ success: true, reply, fallback: true });
});

module.exports = router;
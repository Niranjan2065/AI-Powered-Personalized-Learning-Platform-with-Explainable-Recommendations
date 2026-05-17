// services/aiQuizService.js — AI Quiz Generation with Groq + Fallback
const groq = require('../config/groq');

const MAX_CONTENT_CHARS = 10000;

const TYPE_LABELS = {
  mcq:          'Multiple choice (4 options, exactly one correct)',
  true_false:   'True / False',
  short_answer: 'Short answer (one sentence expected answer)',
};

const BLOOM_MAP = {
  easy:   ['remember', 'understand'],
  medium: ['apply', 'analyze'],
  hard:   ['evaluate', 'create'],
};

function buildPrompt({ content, numQuestions, difficulty, types, focusArea }) {
  const typeLines   = types.map(t => `  - ${TYPE_LABELS[t] || t}`).join('\n');
  const bloomLevels = (BLOOM_MAP[difficulty] || BLOOM_MAP.medium).join(', ');
  const focusLine   = focusArea ? `\nFocus area: ${focusArea}` : '';
  const truncated   = content.slice(0, MAX_CONTENT_CHARS);

  return `You are an expert educational quiz designer.
Generate exactly ${numQuestions} quiz questions from the lesson content below.

Settings:
- Difficulty: ${difficulty}
- Bloom's taxonomy levels: ${bloomLevels}
- Question types:
${typeLines}${focusLine}

Return ONLY valid JSON — no markdown, no code fences, no extra text.

JSON structure:
{
  "questions": [
    {
      "type": "mcq",
      "questionText": "Question here?",
      "difficulty": "medium",
      "topic": "topic tag",
      "bloomLevel": "apply",
      "explanation": "Why this is correct.",
      "points": 1,
      "options": [
        { "text": "Option A", "isCorrect": false },
        { "text": "Option B", "isCorrect": true },
        { "text": "Option C", "isCorrect": false },
        { "text": "Option D", "isCorrect": false }
      ]
    },
    {
      "type": "true_false",
      "questionText": "Statement here.",
      "difficulty": "easy",
      "topic": "topic tag",
      "bloomLevel": "remember",
      "explanation": "Why correct.",
      "points": 1,
      "correctAnswer": "true"
    }
  ]
}

Rules:
- MCQ: exactly 4 options, exactly 1 isCorrect=true
- true_false: correctAnswer = "true" or "false"
- short_answer: correctAnswer = short expected answer
- No options field for true_false or short_answer

LESSON CONTENT:
---
${truncated}
---`;
}

function parseAndValidate(raw) {
  const clean = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); }
      catch { throw new Error('AI returned malformed JSON. Please try again.'); }
    } else {
      throw new Error('AI returned malformed JSON. Please try again.');
    }
  }

  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error('AI returned no questions. Please try again.');
  }

  return parsed.questions.map((q, idx) => {
    if (!q.questionText || !q.type) throw new Error(`Question ${idx + 1} missing required fields.`);

    const base = {
      type: q.type, questionText: String(q.questionText).trim(),
      difficulty: q.difficulty || 'medium', topic: q.topic || '',
      bloomLevel: q.bloomLevel || '', explanation: q.explanation || '',
      points: Number(q.points) || 1,
    };

    if (q.type === 'mcq') {
      if (!Array.isArray(q.options) || q.options.length < 2)
        throw new Error(`MCQ question ${idx + 1} has fewer than 2 options.`);
      if (!q.options.some(o => o.isCorrect === true))
        throw new Error(`MCQ question ${idx + 1} has no correct option.`);
      base.options = q.options.map(o => ({ text: String(o.text || '').trim(), isCorrect: !!o.isCorrect }));
    }

    if (q.type === 'true_false' || q.type === 'short_answer') {
      if (!q.correctAnswer) throw new Error(`Question ${idx + 1} missing correctAnswer.`);
      base.correctAnswer = String(q.correctAnswer).trim();
    }

    return base;
  });
}

// ── Fallback question generator (no API key) ──────────────────
function generateFallbackQuestions({ content, numQuestions, difficulty }) {
  const words = content.split(/\s+/).filter(w => w.length > 4).slice(0, 20);
  const questions = [];

  for (let i = 0; i < Math.min(numQuestions, 5); i++) {
    const word = words[i * 2] || 'concept';
    questions.push({
      type: i % 2 === 0 ? 'mcq' : 'true_false',
      questionText: i % 2 === 0
        ? `Which of the following best describes "${word}" as covered in this lesson?`
        : `The lesson covers the topic of "${word}". (True/False)`,
      difficulty,
      topic: word,
      bloomLevel: 'understand',
      explanation: 'Please configure GROQ_API_KEY for AI-generated explanations.',
      points: 1,
      ...(i % 2 === 0 ? {
        options: [
          { text: `A key concept related to ${word}`, isCorrect: true },
          { text: `An unrelated concept`, isCorrect: false },
          { text: `Something else entirely`, isCorrect: false },
          { text: `None of the above`, isCorrect: false },
        ]
      } : { correctAnswer: 'true' }),
    });
  }

  return questions;
}

// ── Main export ───────────────────────────────────────────────
async function generateQuestions(config) {
  const { content, numQuestions = 5, difficulty = 'medium', types = ['mcq'], focusArea = '' } = config;

  if (!content || content.trim().length < 50)
    throw new Error('Content is too short to generate questions (minimum 50 characters).');

  // Fallback if no Groq client
  if (!groq) {
    console.warn('⚠️  Using fallback question generation (no GROQ_API_KEY)');
    return {
      questions: generateFallbackQuestions({ content, numQuestions, difficulty }),
      meta: { model: 'fallback', provider: 'local', generatedAt: new Date(), note: 'Configure GROQ_API_KEY for AI generation' },
    };
  }

  const prompt = buildPrompt({ content, numQuestions, difficulty, types, focusArea });

  const result = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2048,
    temperature: 0.7,
  });

  const raw = result.choices[0].message.content;
  const questions = parseAndValidate(raw);

  return {
    questions,
    meta: {
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      generatedAt: new Date(),
      inputTokens: result.usage?.prompt_tokens || null,
      outputTokens: result.usage?.completion_tokens || null,
    },
  };
}

module.exports = { generateQuestions };
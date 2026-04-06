// services/aiQuizService.js
// ─────────────────────────────────────────────────────────────
// Quiz generation using Groq (free tier)
// Model: llama-3.3-70b-versatile — fast, smart, free
// Free tier: 14,400 req/day, 500,000 tokens/day
// ─────────────────────────────────────────────────────────────
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

// ── Prompt ────────────────────────────────────────────────────
function buildPrompt({ content, numQuestions, difficulty, types, focusArea }) {
  const typeLines   = types.map(t => `  - ${TYPE_LABELS[t] || t}`).join('\n');
  const bloomLevels = (BLOOM_MAP[difficulty] || BLOOM_MAP.medium).join(', ');
  const focusLine   = focusArea ? `\nFocus area: ${focusArea}` : '';
  const truncated   = content.slice(0, MAX_CONTENT_CHARS);

  return `You are an expert educational quiz designer for an AI-powered learning platform.
Generate exactly ${numQuestions} quiz questions from the lesson content below.

Settings:
- Difficulty: ${difficulty}
- Bloom's taxonomy levels to target: ${bloomLevels}
- Question types to include (distribute proportionally):
${typeLines}${focusLine}

IMPORTANT: Return ONLY a valid JSON object — no markdown, no code fences, no explanation text.

JSON structure to return:
{
  "questions": [
    {
      "type": "mcq",
      "questionText": "Your question here?",
      "difficulty": "medium",
      "topic": "Brief topic tag",
      "bloomLevel": "apply",
      "explanation": "Why this is the correct answer.",
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
      "questionText": "Statement to evaluate.",
      "difficulty": "easy",
      "topic": "Brief topic tag",
      "bloomLevel": "remember",
      "explanation": "Why this answer is correct.",
      "points": 1,
      "correctAnswer": "true"
    }
  ]
}

Rules:
- For MCQ: always include exactly 4 options, exactly 1 must have isCorrect=true
- For true_false: correctAnswer must be exactly "true" or "false"
- For short_answer: correctAnswer must be a short expected answer string
- Do NOT include options field for true_false or short_answer questions
- Do NOT wrap response in markdown code blocks

LESSON CONTENT:
---
${truncated}
---`;
}

// ── Parser & validator ────────────────────────────────────────
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

  const validated = parsed.questions.map((q, idx) => {
    if (!q.questionText || !q.type) {
      throw new Error(`Question ${idx + 1} is missing required fields.`);
    }

    const base = {
      type:         q.type,
      questionText: String(q.questionText).trim(),
      difficulty:   q.difficulty  || 'medium',
      topic:        q.topic       || '',
      bloomLevel:   q.bloomLevel  || '',
      explanation:  q.explanation || '',
      points:       Number(q.points) || 1,
    };

    if (q.type === 'mcq') {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new Error(`MCQ question ${idx + 1} has fewer than 2 options.`);
      }
      if (!q.options.some(o => o.isCorrect === true)) {
        throw new Error(`MCQ question ${idx + 1} has no correct option marked.`);
      }
      base.options = q.options.map(o => ({
        text:      String(o.text || '').trim(),
        isCorrect: !!o.isCorrect,
      }));
    }

    if (q.type === 'true_false' || q.type === 'short_answer') {
      if (!q.correctAnswer) {
        throw new Error(`Question ${idx + 1} (${q.type}) is missing correctAnswer.`);
      }
      base.correctAnswer = String(q.correctAnswer).trim();
    }

    return base;
  });

  return validated;
}

// ── Main exported function ────────────────────────────────────
async function generateQuestions(config) {
  const {
    content,
    numQuestions = 5,
    difficulty   = 'medium',
    types        = ['mcq'],
    focusArea    = '',
  } = config;

  if (!content || content.trim().length < 50) {
    throw new Error('Content is too short to generate meaningful questions.');
  }

  const prompt = buildPrompt({ content, numQuestions, difficulty, types, focusArea });

  // Groq API call
  const result = await groq.chat.completions.create({
    model:      'llama-3.3-70b-versatile', // free + very smart
    messages:   [{ role: 'user', content: prompt }],
    max_tokens: 2048,
    temperature: 0.7,
  });

  const raw = result.choices[0].message.content;
  const questions = parseAndValidate(raw);

  return {
    questions,
    meta: {
      model:        'llama-3.3-70b-versatile',
      provider:     'groq',
      generatedAt:  new Date(),
      inputTokens:  result.usage?.prompt_tokens     || null,
      outputTokens: result.usage?.completion_tokens || null,
    },
  };
}

module.exports = { generateQuestions };
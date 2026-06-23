// backend/ai/feedbackLoop.test.js
// Tests the feedback weight calculation logic — pure functions, no DB.

const { applyFeedbackWeights } = require('./recommendationEngine');

// ── Sample items ──────────────────────────────────────────────────────────────
const makeItem = (topic, confidence = 70, priority = 5) => ({
  _id:            `item_${topic}`,
  type:           'lesson',
  addressesTopic: topic,
  confidence,
  priority,
  isReviewDue:    false,
});

describe('applyFeedbackWeights', () => {

  test('no feedback summary → items unchanged', () => {
    const items = [makeItem('arrays', 70), makeItem('loops', 60)];
    expect(applyFeedbackWeights(items, {})).toEqual(items);
    expect(applyFeedbackWeights(items, null)).toEqual(items);
  });

  test('thumbs_up (weight > 1) → confidence increases', () => {
    const items   = [makeItem('arrays', 70)];
    const summary = { arrays: { weight: 1.5, thumbs_up: 2, thumbs_down: 0, already_know: 0, too_hard: 0 } };
    const result  = applyFeedbackWeights(items, summary);
    expect(result[0].confidence).toBeGreaterThan(70);
    expect(result[0].confidence).toBeLessThanOrEqual(99);
  });

  test('thumbs_down (weight < 1) → confidence decreases', () => {
    const items   = [makeItem('arrays', 70)];
    const summary = { arrays: { weight: 0.5, thumbs_up: 0, thumbs_down: 3, already_know: 0, too_hard: 0 } };
    const result  = applyFeedbackWeights(items, summary);
    expect(result[0].confidence).toBeLessThan(70);
    expect(result[0].confidence).toBeGreaterThanOrEqual(10);
  });

  test('already_know → priority drops to 1', () => {
    const items   = [makeItem('arrays', 80, 8)];
    const summary = { arrays: { weight: 1.2, thumbs_up: 0, thumbs_down: 0, already_know: 2, too_hard: 0 } };
    const result  = applyFeedbackWeights(items, summary);
    expect(result[0].priority).toBe(1);
  });

  test('too_hard → confidence decreases but priority stays', () => {
    const items   = [makeItem('arrays', 70, 5)];
    const summary = { arrays: { weight: 0.8, thumbs_up: 0, thumbs_down: 0, already_know: 0, too_hard: 1 } };
    const result  = applyFeedbackWeights(items, summary);
    expect(result[0].confidence).toBeLessThan(70);
    expect(result[0].priority).toBe(5);
  });

  test('topic with no feedback entry → item unchanged', () => {
    const items   = [makeItem('recursion', 65, 6)];
    const summary = { arrays: { weight: 0.4, thumbs_up: 0, thumbs_down: 2, already_know: 0, too_hard: 0 } };
    const result  = applyFeedbackWeights(items, summary);
    expect(result[0].confidence).toBe(65);
    expect(result[0].priority).toBe(6);
  });

  test('confidence is clamped between 10 and 99', () => {
    const items    = [makeItem('arrays', 99)];
    const summaryH = { arrays: { weight: 1.7, thumbs_up: 5, thumbs_down: 0, already_know: 0, too_hard: 0 } };
    const summaryL = { arrays: { weight: 0.3, thumbs_up: 0, thumbs_down: 5, already_know: 0, too_hard: 0 } };
    expect(applyFeedbackWeights(items, summaryH)[0].confidence).toBeLessThanOrEqual(99);
    expect(applyFeedbackWeights([makeItem('arrays', 10)], summaryL)[0].confidence).toBeGreaterThanOrEqual(10);
  });

  test('multiple items — only matching topic affected', () => {
    const items = [makeItem('arrays', 70), makeItem('loops', 70), makeItem('functions', 70)];
    const summary = { arrays: { weight: 1.6, thumbs_up: 3, thumbs_down: 0, already_know: 0, too_hard: 0 } };
    const result  = applyFeedbackWeights(items, summary);
    expect(result[0].confidence).toBeGreaterThan(70); // arrays boosted
    expect(result[1].confidence).toBe(70);            // loops unchanged
    expect(result[2].confidence).toBe(70);            // functions unchanged
  });

  test('original items array is not mutated', () => {
    const items   = [makeItem('arrays', 70, 5)];
    const summary = { arrays: { weight: 0.3, thumbs_up: 0, thumbs_down: 5, already_know: 0, too_hard: 0 } };
    applyFeedbackWeights(items, summary);
    expect(items[0].confidence).toBe(70); // unchanged
    expect(items[0].priority).toBe(5);   // unchanged
  });
});
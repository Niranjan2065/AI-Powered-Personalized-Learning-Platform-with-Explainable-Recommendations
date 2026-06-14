// backend/ai/forgettingCurve.test.js
// Pure-function tests — no DB, no mocks needed.

const {
  easeFactor,
  computeNextIntervalDays,
  nextReviewDate,
} = require('./forgettingCurve');

// ─────────────────────────────────────────────────────────────
// easeFactor
// ─────────────────────────────────────────────────────────────
describe('easeFactor', () => {
  test('score >= 80 → 2.5', () => expect(easeFactor(80)).toBe(2.5));
  test('score 100  → 2.5', () => expect(easeFactor(100)).toBe(2.5));
  test('score 79   → 2.0', () => expect(easeFactor(79)).toBe(2.0));
  test('score 60   → 2.0', () => expect(easeFactor(60)).toBe(2.0));
  test('score 59   → 1.5', () => expect(easeFactor(59)).toBe(1.5));
  test('score 40   → 1.5', () => expect(easeFactor(40)).toBe(1.5));
  test('score 39   → 1.3', () => expect(easeFactor(39)).toBe(1.3));
  test('score 0    → 1.3', () => expect(easeFactor(0)).toBe(1.3));
});

// ─────────────────────────────────────────────────────────────
// computeNextIntervalDays — first and second reviews are fixed
// ─────────────────────────────────────────────────────────────
describe('computeNextIntervalDays — fixed early intervals', () => {
  test('reviewCount 0, any score → 1 day', () => {
    expect(computeNextIntervalDays(95, 0)).toBe(1);
    expect(computeNextIntervalDays(10, 0)).toBe(1);
  });

  test('reviewCount 1, any score → 3 days', () => {
    expect(computeNextIntervalDays(95, 1)).toBe(3);
    expect(computeNextIntervalDays(10, 1)).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────
// computeNextIntervalDays — exponential growth after review 2+
// ─────────────────────────────────────────────────────────────
describe('computeNextIntervalDays — exponential growth', () => {
  test('score 80, reviewCount 2, last 3 days → 3 × 2.5 = 8 days', () => {
    expect(computeNextIntervalDays(80, 2, 3)).toBe(8);
  });

  test('score 60, reviewCount 2, last 3 days → 3 × 2.0 = 6 days', () => {
    expect(computeNextIntervalDays(60, 2, 3)).toBe(6);
  });

  test('score 50, reviewCount 2, last 3 days → 3 × 1.5 = 5 days (rounded)', () => {
    expect(computeNextIntervalDays(50, 2, 3)).toBe(5);
  });

  test('score 20, reviewCount 2, last 3 days → 3 × 1.3 = 4 days (rounded)', () => {
    expect(computeNextIntervalDays(20, 2, 3)).toBe(4);
  });

  test('score 85, reviewCount 5, last 30 days → 30 × 2.5 = 60 days (cap)', () => {
    // 75 days would exceed cap of 60
    expect(computeNextIntervalDays(85, 5, 30)).toBe(60);
  });

  test('minimum is always 1 day', () => {
    expect(computeNextIntervalDays(0, 2, 0)).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// nextReviewDate — returns a Date in the future
// ─────────────────────────────────────────────────────────────
describe('nextReviewDate', () => {
  test('returns a Date object', () => {
    expect(nextReviewDate(70, 0)).toBeInstanceOf(Date);
  });

  test('first review (reviewCount 0) → ~1 day from now', () => {
    const now  = Date.now();
    const due  = nextReviewDate(70, 0).getTime();
    const diff = due - now;
    // Allow ±1 s tolerance
    expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(25 * 60 * 60 * 1000);
  });

  test('second review (reviewCount 1) → ~3 days from now', () => {
    const now  = Date.now();
    const due  = nextReviewDate(70, 1).getTime();
    const diff = due - now;
    expect(diff).toBeGreaterThan(2 * 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(4 * 24 * 60 * 60 * 1000);
  });

  test('high score, review 2, 3-day interval → ~8 days from now', () => {
    const now  = Date.now();
    const due  = nextReviewDate(85, 2, 3).getTime();
    const diff = due - now;
    const days = diff / (24 * 60 * 60 * 1000);
    expect(days).toBeCloseTo(8, 0);
  });

  test('poor score, review 2, 3-day interval → ~4 days from now', () => {
    const now  = Date.now();
    const due  = nextReviewDate(20, 2, 3).getTime();
    const diff = due - now;
    const days = diff / (24 * 60 * 60 * 1000);
    expect(days).toBeCloseTo(4, 0);
  });
});

// ─────────────────────────────────────────────────────────────
// Retention curve shape — higher scores always give longer intervals
// ─────────────────────────────────────────────────────────────
describe('retention curve — higher score → longer interval', () => {
  test('review 2, last 5 days: score 90 > score 50 > score 30', () => {
    const high = computeNextIntervalDays(90, 2, 5);
    const mid  = computeNextIntervalDays(50, 2, 5);
    const low  = computeNextIntervalDays(30, 2, 5);
    expect(high).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(low);
  });
});
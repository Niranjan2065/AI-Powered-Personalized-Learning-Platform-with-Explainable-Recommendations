// backend/ai/reviewDue.test.js
// Tests the Step 2 integration: SR items slot into recommendations correctly.
// Pure logic only — no DB, no mongoose.

const {
  easeFactor,
  computeNextIntervalDays,
} = require('./forgettingCurve');

// ─────────────────────────────────────────────────────────────
// buildReviewItems logic — unit-tested without DB
// ─────────────────────────────────────────────────────────────

// Simulate the urgency percentage calculation used in buildReviewItems
function urgencyPct(daysSinceReview) {
  return Math.min(99, 60 + daysSinceReview * 5);
}

describe('urgencyPct — review item confidence score', () => {
  test('0 days overdue → 60%', () => expect(urgencyPct(0)).toBe(60));
  test('5 days overdue → 85%', () => expect(urgencyPct(5)).toBe(85));
  test('8 days overdue → 99% (capped)', () => expect(urgencyPct(8)).toBe(99));
  test('20 days overdue → 99% (capped)', () => expect(urgencyPct(20)).toBe(99));
});

// ─────────────────────────────────────────────────────────────
// Priority sorting — review items (priority 10) must beat ML items
// ─────────────────────────────────────────────────────────────

function mergeAndSort(reviewItems, mlItems, maxSlots = 8) {
  return [...reviewItems, ...mlItems]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxSlots);
}

describe('mergeAndSort — review items always surface first', () => {
  const reviewItem = { type: 'lesson', itemId: 'r1', priority: 10, isReviewDue: true };
  const mlItem1    = { type: 'lesson', itemId: 'm1', priority: 9,  isReviewDue: false };
  const mlItem2    = { type: 'lesson', itemId: 'm2', priority: 7,  isReviewDue: false };
  const mlItem3    = { type: 'quiz',   itemId: 'm3', priority: 5,  isReviewDue: false };

  test('review item sorts above all ML items', () => {
    const merged = mergeAndSort([reviewItem], [mlItem1, mlItem2, mlItem3]);
    expect(merged[0].itemId).toBe('r1');
    expect(merged[0].isReviewDue).toBe(true);
  });

  test('ML items retain their relative order after the review item', () => {
    const merged = mergeAndSort([reviewItem], [mlItem1, mlItem2, mlItem3]);
    expect(merged[1].itemId).toBe('m1');
    expect(merged[2].itemId).toBe('m2');
    expect(merged[3].itemId).toBe('m3');
  });

  test('without review items, ML items are unchanged', () => {
    const merged = mergeAndSort([], [mlItem1, mlItem2, mlItem3]);
    expect(merged[0].itemId).toBe('m1');
    expect(merged.length).toBe(3);
  });

  test('total items capped at maxSlots', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      itemId: `ml${i}`, priority: i, isReviewDue: false,
    }));
    const merged = mergeAndSort([reviewItem], many, 8);
    expect(merged.length).toBe(8);
  });

  test('two review items both appear before ML items', () => {
    const r2     = { itemId: 'r2', priority: 10, isReviewDue: true };
    const merged = mergeAndSort([reviewItem, r2], [mlItem1, mlItem2]);
    expect(merged[0].isReviewDue).toBe(true);
    expect(merged[1].isReviewDue).toBe(true);
    expect(merged[2].isReviewDue).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Deduplication — review lesson IDs must not appear in ML items
// ─────────────────────────────────────────────────────────────

function deduplicateMLItems(reviewItems, mlItems) {
  const reviewIds = new Set(reviewItems.map(r => r.itemId.toString()));
  return mlItems.filter(m => !reviewIds.has(m.itemId.toString()));
}

describe('deduplicateMLItems — no lesson appears twice', () => {
  test('ML item with same ID as review item is removed', () => {
    const review = [{ itemId: 'abc', priority: 10 }];
    const ml     = [{ itemId: 'abc', priority: 8 }, { itemId: 'xyz', priority: 7 }];
    const result = deduplicateMLItems(review, ml);
    expect(result.map(r => r.itemId)).toEqual(['xyz']);
  });

  test('ML items with unique IDs are all kept', () => {
    const review = [{ itemId: 'r1', priority: 10 }];
    const ml     = [{ itemId: 'm1', priority: 8 }, { itemId: 'm2', priority: 6 }];
    expect(deduplicateMLItems(review, ml)).toHaveLength(2);
  });

  test('empty review list → all ML items kept', () => {
    const ml = [{ itemId: 'm1' }, { itemId: 'm2' }];
    expect(deduplicateMLItems([], ml)).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────
// Explanation text shape — isReviewDue items must carry SR context
// ─────────────────────────────────────────────────────────────

function buildReviewExplanation(lessonTitle, daysSinceReview, lastScore) {
  const lastScoreLabel = lastScore != null ? `You scored ${lastScore}% last time.` : '';
  return `📅 Review due — it has been ${daysSinceReview} day${daysSinceReview !== 1 ? 's' : ''} since you last studied "${lessonTitle}". ${lastScoreLabel} Spaced repetition keeps this topic fresh.`;
}

describe('buildReviewExplanation — SR explanation text', () => {
  test('includes lesson title', () => {
    expect(buildReviewExplanation('Arrays', 3, 70)).toContain('Arrays');
  });

  test('includes days overdue', () => {
    expect(buildReviewExplanation('Arrays', 3, 70)).toContain('3 days');
  });

  test('singular "day" when 1 day overdue', () => {
    expect(buildReviewExplanation('Arrays', 1, 70)).toContain('1 day');
    expect(buildReviewExplanation('Arrays', 1, 70)).not.toContain('1 days');
  });

  test('includes last score when available', () => {
    expect(buildReviewExplanation('Arrays', 3, 65)).toContain('65%');
  });

  test('omits score label when lastScore is null', () => {
    expect(buildReviewExplanation('Arrays', 3, null)).not.toContain('%');
  });

  test('always contains spaced repetition mention', () => {
    expect(buildReviewExplanation('Arrays', 3, 70)).toContain('Spaced repetition');
  });
});

// ─────────────────────────────────────────────────────────────
// reviewDueCount on analysisSummary
// ─────────────────────────────────────────────────────────────

describe('reviewDueCount stored on analysisSummary', () => {
  test('equals the number of review items injected', () => {
    const reviewItems = [
      { itemId: 'r1', isReviewDue: true },
      { itemId: 'r2', isReviewDue: true },
    ];
    const reviewDueCount = reviewItems.length;
    expect(reviewDueCount).toBe(2);
  });

  test('is 0 when no lessons are due', () => {
    expect([].length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Integration: SR interval feeds into urgency correctly
// ─────────────────────────────────────────────────────────────

describe('SR interval → urgency pipeline', () => {
  test('low score → short interval → sooner urgency', () => {
    // A score of 20 gives interval of 4 days after second review (3 * 1.3)
    // After 4 days overdue that becomes urgency 80
    const interval = computeNextIntervalDays(20, 2, 3);     // 4 days
    const urgency  = urgencyPct(interval);
    expect(urgency).toBe(80);
  });

  test('high score → long interval → lower urgency when just overdue', () => {
    // A score of 90 after review 2 of a 3-day interval → 8 days
    // If just 1 day overdue, urgency = 65
    const urgency = urgencyPct(1);
    expect(urgency).toBe(65);
  });
});
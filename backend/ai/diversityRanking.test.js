// diversityRanking.test.js
// Tests for diversifyRecommendations (recommendation-improvement item #2):
// caps how many items in a row can address the same topic so one dominant
// weak topic can't crowd out the student's other weak spots.

const { diversifyRecommendations } = require("./recommendationEngine");

function item(topic, priority) {
  return { addressesTopic: topic, priority, itemId: `${topic}-${priority}` };
}

describe("diversifyRecommendations", () => {
  test("returns [] for empty/invalid input", () => {
    expect(diversifyRecommendations([])).toEqual([]);
    expect(diversifyRecommendations(null)).toEqual([]);
    expect(diversifyRecommendations(undefined)).toEqual([]);
  });

  test("caps items per topic at maxPerTopic within the trimmed list (real usage always passes a limit)", () => {
    const items = [
      item("Arrays", 9),
      item("Arrays", 8),
      item("Arrays", 7), // would overflow past the cap — pushed below Loops
      item("Loops", 5),
    ];

    const result = diversifyRecommendations(items, { maxPerTopic: 2, limit: 3 });

    expect(result).toHaveLength(3);
    const arraysCount = result.filter(r => r.addressesTopic === "Arrays").length;
    expect(arraysCount).toBe(2);
    expect(result.some(r => r.addressesTopic === "Loops")).toBe(true);
  });

  test("without a limit, no items are dropped — overflow is appended, not discarded", () => {
    const items = [item("Arrays", 9), item("Arrays", 8), item("Arrays", 7)];
    const result = diversifyRecommendations(items, { maxPerTopic: 2 });
    expect(result).toHaveLength(3); // nothing lost, just reordered
  });

  test("fills remaining slots from overflow when topic variety is limited", () => {
    // Only one topic exists, so after the cap (2) is hit, the 3rd item
    // still needs to come from the overflow pool to satisfy `limit`.
    const items = [item("Arrays", 9), item("Arrays", 8), item("Arrays", 7)];

    const result = diversifyRecommendations(items, { maxPerTopic: 2, limit: 3 });

    expect(result).toHaveLength(3);
    expect(result.map(r => r.priority)).toEqual([9, 8, 7]);
  });

  test("spreads across topics instead of stacking the top-priority topic", () => {
    const items = [
      item("Arrays", 10),
      item("Arrays", 9),
      item("Arrays", 8),   // would overflow at maxPerTopic=1
      item("Loops", 7),
      item("Recursion", 6),
    ];

    const result = diversifyRecommendations(items, { maxPerTopic: 1, limit: 3 });

    const topics = result.map(r => r.addressesTopic);
    expect(topics).toEqual(["Arrays", "Loops", "Recursion"]);
  });

  test("does not mutate the input array", () => {
    const items = [item("Arrays", 9), item("Loops", 5)];
    const copy  = [...items];
    diversifyRecommendations(items, { maxPerTopic: 1 });
    expect(items).toEqual(copy);
  });

  test("respects limit even with no topic repetition", () => {
    const items = [item("A", 5), item("B", 4), item("C", 3), item("D", 2)];
    const result = diversifyRecommendations(items, { maxPerTopic: 2, limit: 2 });
    expect(result).toHaveLength(2);
    expect(result.map(r => r.addressesTopic)).toEqual(["A", "B"]);
  });
});
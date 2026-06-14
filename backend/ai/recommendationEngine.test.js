// recommendationEngine.test.js — Jest-compatible version

const {
  resolveScore,
  aggregateTopicPerformance,
  buildRecommendations,
} = require("./recommendationEngine");

// ---------------------------------------------------------------------------
// 1. resolveScore
// ---------------------------------------------------------------------------
describe("resolveScore", () => {
  test("current shape: result.score = 72", () => {
    expect(resolveScore({ result: { score: 72 } })).toBe(72);
  });

  test("legacy shape A: result.percentage = 55", () => {
    expect(resolveScore({ result: { percentage: 55 } })).toBe(55);
  });

  test("legacy shape B: result.percent = 0.9 (fraction → 90)", () => {
    expect(resolveScore({ result: { percent: 0.9 } })).toBe(90);
  });

  test("flat shape: attempt.score = 40", () => {
    expect(resolveScore({ score: 40 })).toBe(40);
  });

  test("totalScore / maxScore: 18/20 → 90", () => {
    expect(resolveScore({ result: { totalScore: 18, maxScore: 20 } })).toBe(90);
  });

  test("undefined result object → null", () => {
    expect(resolveScore({ weakTopics: [] })).toBeNull();
  });

  test("completely empty attempt → null", () => {
    expect(resolveScore({})).toBeNull();
  });

  test("null attempt → null", () => {
    expect(resolveScore(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. aggregateTopicPerformance
// ---------------------------------------------------------------------------
describe("aggregateTopicPerformance", () => {
  test("old attempt (result.score undefined) → topicStats not empty", () => {
    const attempt = {
      weakTopics: [],
      strongTopics: [],
      result: { percentage: 35 }, // result.score missing — the original bug
    };
    const stats = aggregateTopicPerformance([attempt]);
    expect(Object.keys(stats).length).toBeGreaterThan(0);
  });

  test("score 35 → 'general' bucket is 'weak'", () => {
    const attempt = { weakTopics: [], strongTopics: [], result: { percentage: 35 } };
    expect(aggregateTopicPerformance([attempt])["general"]?.bucket).toBe("weak");
  });

  test("score 85 + empty arrays → 'general' bucket is 'strong'", () => {
    const attempt = { weakTopics: [], strongTopics: [], result: { score: 85 } };
    expect(aggregateTopicPerformance([attempt])["general"]?.bucket).toBe("strong");
  });

  test("score 65 + empty arrays → 'general' bucket is 'average'", () => {
    const attempt = { weakTopics: [], strongTopics: [], result: { score: 65 } };
    expect(aggregateTopicPerformance([attempt])["general"]?.bucket).toBe("average");
  });

  test("normal attempt: weak topics are recorded", () => {
    const attempt = {
      weakTopics: ["algebra", "geometry"],
      strongTopics: ["arithmetic"],
      result: { score: 60 },
    };
    const stats = aggregateTopicPerformance([attempt]);
    expect("algebra" in stats).toBe(true);
    expect("arithmetic" in stats).toBe(true);
  });

  test("no spurious 'general' bucket when topic arrays are populated", () => {
    const attempt = {
      weakTopics: ["algebra"],
      strongTopics: ["arithmetic"],
      result: { score: 60 },
    };
    expect("general" in aggregateTopicPerformance([attempt])).toBe(false);
  });

  test("attempt with no score signal at all → topicStats empty (no crash)", () => {
    const stats = aggregateTopicPerformance([{ weakTopics: [], strongTopics: [] }]);
    expect(Object.keys(stats).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. buildRecommendations
// ---------------------------------------------------------------------------
describe("buildRecommendations", () => {
  const catalogue = {
    general: {
      remedial:      [{ id: "g-r1", title: "Foundations Review" }],
      consolidation: [{ id: "g-c1", title: "Core Concepts" }],
      advanced:      [{ id: "g-a1", title: "Challenge Pack" }],
    },
  };

  const firstQuizAttempt = {
    weakTopics: [],
    strongTopics: [],
    result: {
      percentage: 42, // result.score absent — old attempt shape
      nextLesson: { id: "nl1", title: "Intro Lesson" },
    },
  };

  test("first quiz returns status 'ok'", () => {
    expect(buildRecommendations([firstQuizAttempt], catalogue).status).toBe("ok");
  });

  test("recommendations array is non-empty", () => {
    const { recommendations } = buildRecommendations([firstQuizAttempt], catalogue);
    expect(recommendations.length).toBeGreaterThan(0);
  });

  test("score 42 → recommendation type is 'remedial'", () => {
    const { recommendations } = buildRecommendations([firstQuizAttempt], catalogue);
    expect(recommendations[0]?.type).toBe("remedial");
  });

  test("recommendation topic is 'general'", () => {
    const { recommendations } = buildRecommendations([firstQuizAttempt], catalogue);
    expect(recommendations[0]?.topic).toBe("general");
  });

  test("remedial recommendation includes at least one lesson", () => {
    const { recommendations } = buildRecommendations([firstQuizAttempt], catalogue);
    expect(recommendations[0]?.lessons?.length).toBeGreaterThan(0);
  });

  test("zero attempts → status 'not_enough_data'", () => {
    expect(buildRecommendations([], catalogue).status).toBe("not_enough_data");
  });
});
import { assert, assertEquals, assertThrows } from "@std/assert";
import { ValidationError } from "../src/modules/shared/errors.ts";
import {
  calculatePerformancePointContributions,
  calculatePerformancePoints,
} from "../src/modules/submissions/performance-points.ts";
import { weeklyWindow } from "../src/modules/submissions/performance-queries.ts";
import {
  isBetterRecord,
  leaderboardPool,
  rankLeaderboardRecords,
} from "../src/modules/submissions/ranking.ts";
import {
  assertValidSubmissionValues,
  competitorKeyFor,
  validateProofs,
} from "../src/modules/submissions/validation.ts";

Deno.test("record comparison supports direction and round-duration ties", () => {
  assert(isBetterRecord(101, 100, null, null, "round", "higher_is_better"));
  assert(isBetterRecord(99, 100, null, null, "time", "lower_is_better"));
  assert(isBetterRecord(100, 100, 90_000, 100_000, "round", "higher_is_better"));
  assertEquals(isBetterRecord(100, 100, null, 100_000, "round", "higher_is_better"), false);
});

Deno.test("leaderboard points follow a smooth score-proximity curve", () => {
  const submittedAt = new Date("2026-01-01T00:00:00Z");
  const rows = [100, 90, 80].map((scoreValue, index) => ({
    submissionId: index + 1,
    userId: `user-${index + 1}`,
    scoreValue,
    runDurationMs: null,
    proofLevel: "manual_video",
    proofUrl: null,
    submittedAt,
    userName: `User ${index + 1}`,
    userImage: null,
  }));
  const ranked = rankLeaderboardRecords(rows, "higher_is_better", leaderboardPool(3));
  assertEquals(ranked.map((entry) => entry.rank), [1, 2, 3]);
  assertEquals(ranked.map((entry) => entry.points), [262.13, 172.22, 113.82]);
  assertEquals(ranked.map((entry) => entry.pointBreakdown.rankFactor), [1, 0.9013, 0.8481]);
  assertEquals(ranked.map((entry) => entry.pointBreakdown.podiumBonus), [1, 1, 1]);
});

Deno.test("performance points cap the long tail", () => {
  const topOnly = calculatePerformancePoints(Array.from({ length: 50 }, () => 100));
  const withLongTail = calculatePerformancePoints([
    ...Array.from({ length: 50 }, () => 100),
    ...Array.from({ length: 1_000 }, () => 99),
  ]);
  assert(withLongTail <= Number((topOnly * (10 / 9)).toFixed(2)));
  const contributions = calculatePerformancePointContributions([
    ...Array.from({ length: 50 }, () => 100),
    ...Array.from({ length: 1_000 }, () => 99),
  ]);
  assertEquals(
    Number(contributions.reduce((total, points) => total + points, 0).toFixed(2)),
    withLongTail,
  );
  assertEquals(contributions[0], 100);
  assert(contributions[50]! < 49.5);
});

Deno.test("weekly records reset every Tuesday at midnight UTC", () => {
  assertEquals(weeklyWindow(new Date("2026-07-22T14:30:00Z")), {
    startsAt: new Date("2026-07-21T00:00:00Z"),
    endsAt: new Date("2026-07-28T00:00:00Z"),
  });
  assertEquals(weeklyWindow(new Date("2026-07-21T00:00:00Z")).startsAt, new Date("2026-07-21T00:00:00Z"));
});

Deno.test("submission validation rejects invalid values and unverifiable proofs", () => {
  assertThrows(() => assertValidSubmissionValues(0, null), ValidationError);
  assertThrows(() => assertValidSubmissionValues(10, -1), ValidationError);
  assertThrows(
    () => validateProofs([{ type: "video" }]),
    ValidationError,
  );
  assertThrows(
    () => validateProofs([{ type: "demo", sourceUrl: "https://example.test/run.dem" }]),
    ValidationError,
  );
  validateProofs([{
    type: "demo",
    sourceUrl: "https://example.test/run.dem",
    sha256: "a".repeat(64),
    formatVersion: 1,
  }]);
});

Deno.test("competitor keys are stable regardless of participant order", () => {
  assertEquals(competitorKeyFor(["b", "a"]), competitorKeyFor(["a", "b"]));
  assertEquals(competitorKeyFor(["b", "a"]), "team:a:b");
});

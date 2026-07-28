import { assert, assertEquals } from "@std/assert";
import { eq } from "drizzle-orm";
import { bestRecords, submissions } from "../src/db/schema.ts";
import {
  createAuthenticatedUser,
  createCategory,
  createCategoryAssignment,
  createGame,
  createMap,
  reviewSubmissionResponse,
  setup,
  submitScore,
} from "./helpers.ts";

Deno.test("concurrent reviews keep only the best run for one competitor", async () => {
  const { app, db, headers } = await setup(["ROLE_USER", "ROLE_ADMIN"]);
  const game = await createGame(app, headers, "concurrency-game");
  const map = await createMap(app, headers, game.id, "concurrency-map");
  const category = await createCategory(app, headers, {
    slug: "concurrency-round",
    name: "Concurrency Round",
    scoreType: "round",
    rankingDirection: "higher_is_better",
  });
  const assignment = await createCategoryAssignment(app, headers, {
    categoryId: category.id,
    gameId: game.id,
    mapId: map.id,
  });
  const player = await createAuthenticatedUser(app, db, ["ROLE_USER"]);
  const lower = await submitScore(app, player.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: assignment.id,
    scoreValue: 100,
    proofLevel: "manual_video",
  });
  const higher = await submitScore(app, player.headers, {
    gameId: game.id,
    mapId: map.id,
    categoryAssignmentId: assignment.id,
    scoreValue: 101,
    proofLevel: "manual_video",
  });

  const responses = await Promise.all([
    reviewSubmissionResponse(app, headers, lower.id, "verified"),
    reviewSubmissionResponse(app, headers, higher.id, "verified"),
  ]);
  assertEquals(responses.map((response) => response.status), [200, 200]);

  const records = await db.select({
    submissionId: bestRecords.submissionId,
    scoreValue: submissions.scoreValue,
  }).from(bestRecords).innerJoin(submissions, eq(bestRecords.submissionId, submissions.id));
  assertEquals(records.length, 1);
  assertEquals(records[0]?.submissionId, higher.id);
  assertEquals(records[0]?.scoreValue, 101);
  assert(
    (await Promise.all(responses.map((response) => response.json()))).some((body) => body.recordUpdated),
  );
});

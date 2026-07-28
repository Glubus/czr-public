import { assertEquals } from "@std/assert";
import { submissions } from "../src/db/schema.ts";
import {
  createAuthenticatedUser,
  createCategory,
  createCategoryAssignment,
  createGame,
  createMap,
  setup,
} from "./helpers.ts";

Deno.test("manual submissions are atomically limited to five active reviews", async () => {
  const { app, db, headers } = await setup(["ROLE_ADMIN"]);
  const game = await createGame(app, headers, "quota-game");
  const map = await createMap(app, headers, game.id, "quota-map");
  const category = await createCategory(app, headers, {
    slug: "quota-round",
    name: "Quota round",
    scoreType: "round",
    rankingDirection: "higher_is_better",
  });
  const assignment = await createCategoryAssignment(app, headers, {
    categoryId: category.id,
    gameId: game.id,
    mapId: map.id,
  });
  const player = await createAuthenticatedUser(app, db, ["ROLE_USER"]);

  await db.insert(submissions).values({
    externalId: "zwr:submission:automatic-quota-fixture",
    userId: player.userId,
    submittedBy: player.userId,
    competitorKey: player.userId,
    gameId: game.id,
    mapId: map.id,
    categoryId: category.id,
    categoryAssignmentId: assignment.id,
    scoreValue: 1,
    proofLevel: "manual_video",
  });

  const responses = await Promise.all(
    [10, 11, 12, 13, 14].map((scoreValue) =>
      app.request("/submissions", {
        method: "POST",
        headers: player.headers,
        body: JSON.stringify({
          gameId: game.id,
          mapId: map.id,
          categoryAssignmentId: assignment.id,
          scoreValue,
          proofLevel: "manual_video",
        }),
      })
    ),
  );
  assertEquals(responses.every((response) => response.status === 201), true);

  const limited = await submit(app, player.headers, game.id, map.id, assignment.id, 15);
  assertEquals(limited.status, 409);
  assertEquals((await limited.json()).code, "conflict");

  const first = await responses[0]!.json();
  const reviewed = await app.request(`/admin/submissions/${first.id}/status`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status: "rejected", reviewNote: "capacity test" }),
  });
  assertEquals(reviewed.status, 200);
  assertEquals((await submit(app, player.headers, game.id, map.id, assignment.id, 16)).status, 201);
});

function submit(
  app: Parameters<typeof createGame>[0],
  headers: HeadersInit,
  gameId: number,
  mapId: number,
  categoryAssignmentId: number,
  scoreValue: number,
) {
  return app.request("/submissions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      gameId,
      mapId,
      categoryAssignmentId,
      scoreValue,
      proofLevel: "manual_video",
    }),
  });
}

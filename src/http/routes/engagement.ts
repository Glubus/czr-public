import { Effect } from "effect";
import { Hono } from "hono";
import { type AuthEnv, isGranted } from "../../auth/authorization.ts";
import type { Database } from "../../db/client.ts";
import {
  createAchievement,
  createChallenge,
  createGoal,
  getAchievementLeaderboard,
  listAchievements,
  listChallenges,
  listGoals,
  recalculateAllAchievements,
  updateGoal,
} from "../../modules/engagement/service.ts";
import { moderationOverview } from "../../modules/moderation/service.ts";
import type { HttpEffectRunner } from "../route-support.ts";

type RequestJson = (context: Parameters<HttpEffectRunner>[0]) => Effect.Effect<unknown, unknown>;

export function registerEngagementRoutes(
  app: Hono<AuthEnv>,
  db: Database,
  run: HttpEffectRunner,
  requestJson: RequestJson,
) {
  app.post("/me/goals", isGranted("ROLE_USER"), (c) =>
    run(
      c,
      requestJson(c).pipe(Effect.flatMap((body) => createGoal(db, c.get("currentUser")!.id, body))),
      (value) => c.json(value, 201),
    ));
  app.get(
    "/me/goals",
    isGranted("ROLE_USER"),
    (c) => run(c, listGoals(db, c.get("currentUser")!.id), (value) => c.json(value)),
  );
  app.patch("/me/goals/:id", isGranted("ROLE_USER"), (c) =>
    run(
      c,
      requestJson(c).pipe(
        Effect.flatMap((body) => updateGoal(db, c.get("currentUser")!.id, Number(c.req.param("id")), body)),
      ),
      (value) => c.json(value),
    ));

  app.get(
    "/achievements",
    (c) => run(c, listAchievements(db, c.get("currentUser")?.id), (value) => c.json(value)),
  );
  app.get(
    "/leaderboard/achievements",
    (c) =>
      run(
        c,
        getAchievementLeaderboard(db, c.req.query("page"), c.req.query("country")),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/users/:id/achievements",
    (c) => run(c, listAchievements(db, c.req.param("id")), (value) => c.json(value)),
  );
  app.post(
    "/admin/achievements",
    isGranted("ROLE_ADMIN"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => createAchievement(db, body))),
        (value) => c.json(value, 201),
      ),
  );
  app.post(
    "/admin/achievements/recalculate",
    isGranted("ROLE_ADMIN"),
    (c) => run(c, recalculateAllAchievements(db), (value) => c.json(value)),
  );

  app.get(
    "/challenges",
    (c) => run(c, listChallenges(db, c.get("currentUser")?.id), (value) => c.json(value)),
  );
  app.post(
    "/admin/challenges",
    isGranted("ROLE_ADMIN"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => createChallenge(db, body))),
        (value) => c.json(value, 201),
      ),
  );

  app.get(
    "/admin/moderation/overview",
    isGranted("submission:review"),
    (c) => run(c, moderationOverview(db), (value) => c.json(value)),
  );
}

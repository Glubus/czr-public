import { Effect } from "effect";
import { Hono } from "hono";
import { type AuthEnv, isGranted } from "../../auth/authorization.ts";
import type { Database } from "../../db/client.ts";
import {
  createPersonalRun,
  deletePersonalRun,
  listOwnPersonalRuns,
  listPersonalBests,
  listUserPersonalRuns,
  promotePersonalRun,
  updatePersonalRun,
} from "../../modules/personal-runs/service.ts";
import type { HttpEffectRunner } from "../route-support.ts";

type RequestJson = (context: Parameters<HttpEffectRunner>[0]) => Effect.Effect<unknown, unknown>;

export function registerPersonalRunRoutes(
  app: Hono<AuthEnv>,
  db: Database,
  run: HttpEffectRunner,
  requestJson: RequestJson,
) {
  app.post(
    "/me/personal-runs",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(
          Effect.flatMap((body) => createPersonalRun(db, c.get("currentUser")!.id, body)),
        ),
        (value) => c.json(value, 201),
      ),
  );
  app.get(
    "/me/personal-runs",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        listOwnPersonalRuns(db, c.get("currentUser")!.id, c.req.query("cursor")),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/me/personal-runs/bests",
    isGranted("ROLE_USER"),
    (c) => run(c, listPersonalBests(db, c.get("currentUser")!.id), (value) => c.json(value)),
  );
  app.patch(
    "/me/personal-runs/:id",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(
          Effect.flatMap((body) =>
            updatePersonalRun(db, c.get("currentUser")!.id, Number(c.req.param("id")), body)
          ),
        ),
        (value) => c.json(value),
      ),
  );
  app.delete(
    "/me/personal-runs/:id",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        deletePersonalRun(db, c.get("currentUser")!.id, Number(c.req.param("id"))),
        (value) => c.json(value),
      ),
  );
  app.post(
    "/me/personal-runs/:id/promote",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        promotePersonalRun(db, c.get("currentUser")!.id, Number(c.req.param("id"))),
        (value) => c.json(value, 201),
      ),
  );
  app.get(
    "/users/:id/personal-runs",
    (c) =>
      run(
        c,
        listUserPersonalRuns(db, c.req.param("id"), c.get("currentUser")?.id, c.req.query("cursor")),
        (value) => c.json(value),
      ),
  );
}

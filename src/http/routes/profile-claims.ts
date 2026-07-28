import { Effect } from "effect";
import { Hono } from "hono";
import { type AuthEnv, isGranted } from "../../auth/authorization.ts";
import type { Database } from "../../db/client.ts";
import {
  createProfileClaim,
  listOwnProfileClaims,
  listProfileClaims,
  reviewProfileClaim,
} from "../../modules/profile-claims/service.ts";
import type { HttpEffectRunner } from "../route-support.ts";

type RequestJson = (context: Parameters<HttpEffectRunner>[0]) => Effect.Effect<unknown, unknown>;

export function registerProfileClaimRoutes(
  app: Hono<AuthEnv>,
  db: Database,
  run: HttpEffectRunner,
  requestJson: RequestJson,
) {
  app.post(
    "/profile-claims",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(
          Effect.flatMap((body) => createProfileClaim(db, c.get("currentUser")!.id, body)),
        ),
        (value) => c.json(value, 201),
      ),
  );
  app.get(
    "/me/profile-claims",
    isGranted("ROLE_USER"),
    (c) => run(c, listOwnProfileClaims(db, c.get("currentUser")!.id), (value) => c.json(value)),
  );
  app.get(
    "/admin/profile-claims",
    isGranted("profile-claim:review"),
    (c) => run(c, listProfileClaims(db, c.req.query("status")), (value) => c.json(value)),
  );
  app.patch(
    "/admin/profile-claims/:id/status",
    isGranted("profile-claim:review"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(
          Effect.flatMap((body) =>
            reviewProfileClaim(db, Number(c.req.param("id")), c.get("currentUser")!.id, body)
          ),
        ),
        (value) => c.json(value),
      ),
  );
}

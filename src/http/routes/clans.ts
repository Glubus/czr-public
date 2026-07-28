import { Effect } from "effect";
import { Hono } from "hono";
import { type AuthEnv, isGranted } from "../../auth/authorization.ts";
import type { Database } from "../../db/client.ts";
import {
  createClan,
  createClanInvitation,
  getClanBySlug,
  getClanPreferences,
  getOwnClan,
  listClanAuditEvents,
  listClanInvitations,
  listOwnClanInvitations,
  removeClanMember,
  respondClanInvitation,
  revokeClanInvitation,
  transferClanOwnership,
  updateClanMemberRole,
  updateClanPreferences,
} from "../../modules/clans/service.ts";
import type { HttpEffectRunner } from "../route-support.ts";

type RequestJson = (context: Parameters<HttpEffectRunner>[0]) => Effect.Effect<unknown, unknown>;

export function registerClanRoutes(
  app: Hono<AuthEnv>,
  db: Database,
  run: HttpEffectRunner,
  requestJson: RequestJson,
) {
  app.post(
    "/clans",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => createClan(db, c.get("currentUser")!.id, body))),
        (value) => c.json(value, 201),
      ),
  );
  app.get("/clans/:slug", (c) => run(c, getClanBySlug(db, c.req.param("slug")), (value) => c.json(value)));
  app.get(
    "/me/clan",
    isGranted("ROLE_USER"),
    (c) => run(c, getOwnClan(db, c.get("currentUser")!.id), (value) => c.json(value)),
  );
  app.patch(
    "/me/clan-preferences",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(
          Effect.flatMap((body) => updateClanPreferences(db, c.get("currentUser")!.id, body)),
        ),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/me/clan-preferences",
    isGranted("ROLE_USER"),
    (c) => run(c, getClanPreferences(db, c.get("currentUser")!.id), (value) => c.json(value)),
  );
  app.post(
    "/clans/:id/invitations",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(
          Effect.flatMap((body) =>
            createClanInvitation(db, Number(c.req.param("id")), c.get("currentUser")!.id, body)
          ),
        ),
        (value) => c.json(value, 201),
      ),
  );
  app.get(
    "/me/clan-invitations",
    isGranted("ROLE_USER"),
    (c) => run(c, listOwnClanInvitations(db, c.get("currentUser")!.id), (value) => c.json(value)),
  );
  app.get(
    "/clans/:id/invitations",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        listClanInvitations(db, Number(c.req.param("id")), c.get("currentUser")!.id),
        (value) => c.json(value),
      ),
  );
  app.patch(
    "/me/clan-invitations/:id",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(
          Effect.flatMap((body) =>
            respondClanInvitation(db, Number(c.req.param("id")), c.get("currentUser")!.id, body)
          ),
        ),
        (value) => c.json(value),
      ),
  );
  app.delete(
    "/clans/:clanId/invitations/:invitationId",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        revokeClanInvitation(
          db,
          Number(c.req.param("clanId")),
          Number(c.req.param("invitationId")),
          c.get("currentUser")!.id,
        ),
        (value) => c.json(value),
      ),
  );
  app.patch(
    "/clans/:clanId/members/:userId/role",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(
          Effect.flatMap((body) =>
            updateClanMemberRole(
              db,
              Number(c.req.param("clanId")),
              c.req.param("userId"),
              c.get("currentUser")!.id,
              body,
            )
          ),
        ),
        (value) => c.json(value),
      ),
  );
  app.patch(
    "/clans/:id/owner",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(
          Effect.flatMap((body) =>
            transferClanOwnership(db, Number(c.req.param("id")), c.get("currentUser")!.id, body)
          ),
        ),
        (value) => c.json(value),
      ),
  );
  app.delete(
    "/clans/:clanId/members/:userId",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        removeClanMember(
          db,
          Number(c.req.param("clanId")),
          c.req.param("userId"),
          c.get("currentUser")!.id,
        ),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/clans/:id/audit-events",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        listClanAuditEvents(db, Number(c.req.param("id")), c.get("currentUser")!.id),
        (value) => c.json(value),
      ),
  );
}

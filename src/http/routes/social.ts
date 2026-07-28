import { Effect } from "effect";
import { Hono } from "hono";
import { type AuthEnv, isGranted } from "../../auth/authorization.ts";
import type { Database } from "../../db/client.ts";
import {
  createFollow,
  deleteFollow,
  listFeed,
  listFollows,
  listNotifications,
  readAllNotifications,
  readNotification,
  unreadNotificationCount,
} from "../../modules/social/service.ts";
import type { HttpEffectRunner } from "../route-support.ts";

type RequestJson = (context: Parameters<HttpEffectRunner>[0]) => Effect.Effect<unknown, unknown>;

export function registerSocialRoutes(
  app: Hono<AuthEnv>,
  db: Database,
  run: HttpEffectRunner,
  requestJson: RequestJson,
) {
  app.post(
    "/me/follows",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(
          Effect.flatMap((body) => createFollow(db, c.get("currentUser")!.id, body)),
        ),
        (value) => c.json(value, 201),
      ),
  );
  app.delete(
    "/me/follows/:targetType/:targetId",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        deleteFollow(db, c.get("currentUser")!.id, c.req.param("targetType"), c.req.param("targetId")),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/me/follows",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        listFollows(db, c.get("currentUser")!.id, c.req.query("type")),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/me/feed",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        listFeed(db, c.get("currentUser")!.id, {
          cursor: c.req.query("cursor"),
          type: c.req.query("type"),
        }),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/me/notifications",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        listNotifications(db, c.get("currentUser")!.id, {
          cursor: c.req.query("cursor"),
          unread: c.req.query("unread"),
          type: c.req.query("type"),
        }),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/me/notifications/unread-count",
    isGranted("ROLE_USER"),
    (c) => run(c, unreadNotificationCount(db, c.get("currentUser")!.id), (value) => c.json(value)),
  );
  app.patch(
    "/me/notifications/:id/read",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        readNotification(db, c.get("currentUser")!.id, Number(c.req.param("id"))),
        (value) => c.json(value),
      ),
  );
  app.post(
    "/me/notifications/read-all",
    isGranted("ROLE_USER"),
    (c) => run(c, readAllNotifications(db, c.get("currentUser")!.id), (value) => c.json(value)),
  );
}

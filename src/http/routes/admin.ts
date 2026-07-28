import { Effect } from "effect";
import { Hono } from "hono";
import { type AuthEnv, isGranted } from "../../auth/authorization.ts";
import type { Database } from "../../db/client.ts";
import {
  createCategory,
  createCategoryAssignment,
  deleteCategory,
  deleteCategoryAssignment,
  listCategoryAssignments,
  listCategoryDefinitions,
  updateCategory,
  updateCategoryAssignment,
} from "../../modules/categories/service.ts";
import { createGame, updateGame } from "../../modules/games/service.ts";
import { createMap, updateMap, updateMapStatus } from "../../modules/maps/service.ts";
import { createMod, deleteMod, updateMod } from "../../modules/mods/service.ts";
import { updateUserRoles } from "../../modules/users/service.ts";
import {
  assignUserBadge,
  createBadgeDefinition,
  listBadgeDefinitions,
  removeUserBadge,
} from "../../modules/users/badges.ts";
import type { HttpEffectRunner } from "../route-support.ts";

type RequestJson = (context: Parameters<HttpEffectRunner>[0]) => Effect.Effect<unknown, unknown>;

/** All privileged catalogue and authorization mutations live behind this boundary. */
export function registerAdminRoutes(
  app: Hono<AuthEnv>,
  db: Database,
  run: HttpEffectRunner,
  requestJson: RequestJson,
) {
  app.post(
    "/admin/games",
    isGranted("game:create"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => createGame(db, body))),
        (value) => c.json(value, 201),
      ),
  );
  app.patch(
    "/admin/games/:id",
    isGranted("game:create"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => updateGame(db, Number(c.req.param("id")), body))),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/admin/badges",
    isGranted("user:roles"),
    (c) => run(c, listBadgeDefinitions(db), (value) => c.json(value)),
  );
  app.post(
    "/admin/badges",
    isGranted("user:roles"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => createBadgeDefinition(db, body))),
        (value) => c.json(value, 201),
      ),
  );
  app.put(
    "/admin/users/:id/badges/:badgeId",
    isGranted("user:roles"),
    (c) =>
      run(
        c,
        assignUserBadge(
          db,
          c.req.param("id"),
          Number(c.req.param("badgeId")),
          c.get("currentUser")!.id,
        ),
        (value) => c.json(value),
      ),
  );
  app.delete(
    "/admin/users/:id/badges/:badgeId",
    isGranted("user:roles"),
    (c) =>
      run(
        c,
        removeUserBadge(db, c.req.param("id"), Number(c.req.param("badgeId"))),
        (value) => c.json(value),
      ),
  );
  app.post(
    "/admin/maps",
    isGranted("map:create"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => createMap(db, body))),
        (value) => c.json(value, 201),
      ),
  );
  app.patch(
    "/admin/maps/:id",
    isGranted("map:create"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => updateMap(db, Number(c.req.param("id")), body))),
        (value) => c.json(value),
      ),
  );
  app.patch(
    "/admin/maps/:id/status",
    isGranted("map:create"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => updateMapStatus(db, Number(c.req.param("id")), body))),
        (value) => c.json(value),
      ),
  );
  app.post(
    "/admin/mods",
    isGranted("mod:create"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => createMod(db, body))),
        (value) => c.json(value, 201),
      ),
  );
  app.patch(
    "/admin/mods/:id",
    isGranted("mod:create"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => updateMod(db, Number(c.req.param("id")), body))),
        (value) => c.json(value),
      ),
  );
  app.delete(
    "/admin/mods/:id",
    isGranted("mod:create"),
    (c) => run(c, deleteMod(db, Number(c.req.param("id"))), (value) => c.json(value)),
  );
  app.patch(
    "/admin/users/:id/roles",
    isGranted("user:roles"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => updateUserRoles(db, c.req.param("id"), body))),
        (value) => c.json(value),
      ),
  );
  app.post(
    "/admin/categories",
    isGranted("category:create"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => createCategory(db, body))),
        (value) => c.json(value, 201),
      ),
  );
  app.get(
    "/admin/categories",
    isGranted("category:create"),
    (c) => run(c, listCategoryDefinitions(db), (value) => c.json(value)),
  );
  app.patch(
    "/admin/categories/:id",
    isGranted("category:create"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => updateCategory(db, Number(c.req.param("id")), body))),
        (value) => c.json(value),
      ),
  );
  app.delete(
    "/admin/categories/:id",
    isGranted("category:create"),
    (c) => run(c, deleteCategory(db, Number(c.req.param("id"))), (value) => c.json(value)),
  );
  app.post(
    "/admin/category-assignments",
    isGranted("category:assign"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => createCategoryAssignment(db, body))),
        (value) => c.json(value, 201),
      ),
  );
  app.get(
    "/admin/category-assignments",
    isGranted("category:assign"),
    (c) =>
      run(
        c,
        listCategoryAssignments(db, {
          page: c.req.query("page"),
          gameId: c.req.query("gameId"),
          mapId: c.req.query("mapId"),
        }),
        (value) => c.json(value),
      ),
  );
  app.patch(
    "/admin/category-assignments/:id",
    isGranted("category:assign"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(
          Effect.flatMap((body) => updateCategoryAssignment(db, Number(c.req.param("id")), body)),
        ),
        (value) => c.json(value),
      ),
  );
  app.delete(
    "/admin/category-assignments/:id",
    isGranted("category:assign"),
    (c) => run(c, deleteCategoryAssignment(db, Number(c.req.param("id"))), (value) => c.json(value)),
  );
}

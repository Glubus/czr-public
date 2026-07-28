import { Effect } from "effect";
import { Hono } from "hono";
import { type AuthEnv, isGranted } from "../../auth/authorization.ts";
import type { Database } from "../../db/client.ts";
import { listCategoriesForMap } from "../../modules/categories/service.ts";
import { previewMapImport } from "../../modules/map-import/service.ts";
import type { HttpEffectRunner } from "../route-support.ts";

type RequestJson = (context: Parameters<HttpEffectRunner>[0]) => Effect.Effect<unknown, unknown>;

export function registerMapRoutes(
  app: Hono<AuthEnv>,
  db: Database,
  run: HttpEffectRunner,
  requestJson: RequestJson,
) {
  app.get(
    "/maps/:id/categories",
    (c) => run(c, listCategoriesForMap(db, Number(c.req.param("id"))), (value) => c.json(value)),
  );
  app.post(
    "/maps/preview",
    isGranted("map:preview"),
    (c) => run(c, requestJson(c).pipe(Effect.flatMap(previewMapImport)), (value) => c.json(value)),
  );
}

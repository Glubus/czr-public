import { Effect } from "effect";
import { Hono } from "hono";
import { type AuthEnv, isGranted } from "../../auth/authorization.ts";
import type { Database } from "../../db/client.ts";
import type { BlobStore } from "../../infra/blob-store.ts";
import {
  abandonClientRun,
  appendClientRunChunk,
  finalizeClientRun,
  getClientRun,
  heartbeatClientRun,
  listClientVersions,
  listInstallations,
  recoverClientRun,
  registerClientVersion,
  registerInstallation,
  revokeInstallation,
  startClientRun,
  updateClientVersion,
} from "../../modules/client-ingestion/service.ts";
import type { HttpEffectRunner } from "../route-support.ts";

type RequestJson = (context: Parameters<HttpEffectRunner>[0]) => Effect.Effect<unknown, unknown>;

export function registerClientIngestionRoutes(
  app: Hono<AuthEnv>,
  db: Database,
  blobStore: BlobStore,
  run: HttpEffectRunner,
  requestJson: RequestJson,
) {
  app.post(
    "/admin/client-versions",
    isGranted("ROLE_ADMIN"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => registerClientVersion(db, body))),
        (value) => c.json(value, 201),
      ),
  );
  app.get(
    "/admin/client-versions",
    isGranted("ROLE_ADMIN"),
    (c) => run(c, listClientVersions(db), (value) => c.json({ entries: value })),
  );
  app.patch("/admin/client-versions/:id", isGranted("ROLE_ADMIN"), (c) =>
    run(
      c,
      requestJson(c).pipe(
        Effect.flatMap((body) => updateClientVersion(db, Number(c.req.param("id")), body)),
      ),
      (value) => c.json(value),
    ));
  app.post("/me/client-installations", isGranted("ROLE_USER"), (c) =>
    run(
      c,
      requestJson(c).pipe(
        Effect.flatMap((body) => registerInstallation(db, c.get("currentUser")!.id, body)),
      ),
      (value) => c.json(value, 201),
    ));
  app.get(
    "/me/client-installations",
    isGranted("ROLE_USER"),
    (c) => run(c, listInstallations(db, c.get("currentUser")!.id), (value) => c.json({ entries: value })),
  );
  app.delete("/me/client-installations/:id", isGranted("ROLE_USER"), (c) =>
    run(
      c,
      revokeInstallation(db, c.get("currentUser")!.id, c.req.param("id")),
      (value) => c.json(value),
    ));
  app.post("/me/client-runs", isGranted("ROLE_USER"), (c) =>
    run(
      c,
      requestJson(c).pipe(
        Effect.flatMap((body) => startClientRun(db, c.get("currentUser")!.id, body)),
      ),
      (value) => c.json(value, 201),
    ));
  app.get(
    "/me/client-runs/:id",
    isGranted("ROLE_USER"),
    (c) => run(c, getClientRun(db, c.get("currentUser")!.id, c.req.param("id")), (value) => c.json(value)),
  );
  app.post("/me/client-runs/:id/heartbeat", isGranted("ROLE_USER"), (c) =>
    run(
      c,
      requestJson(c).pipe(
        Effect.flatMap((body) => heartbeatClientRun(db, c.get("currentUser")!.id, c.req.param("id"), body)),
      ),
      (value) => c.json(value),
    ));
  app.post("/me/client-runs/:id/chunks", isGranted("ROLE_USER"), (c) =>
    run(
      c,
      requestJson(c).pipe(
        Effect.flatMap((body) =>
          appendClientRunChunk(db, blobStore, c.get("currentUser")!.id, c.req.param("id"), body)
        ),
      ),
      (value) => c.json(value, value.idempotentReplay ? 200 : 201),
    ));
  app.post("/me/client-runs/:id/recover", isGranted("ROLE_USER"), (c) =>
    run(
      c,
      requestJson(c).pipe(
        Effect.flatMap((body) => recoverClientRun(db, c.get("currentUser")!.id, c.req.param("id"), body)),
      ),
      (value) => c.json(value),
    ));
  app.post("/me/client-runs/:id/finalize", isGranted("ROLE_USER"), (c) =>
    run(
      c,
      requestJson(c).pipe(
        Effect.flatMap((body) =>
          finalizeClientRun(db, blobStore, c.get("currentUser")!.id, c.req.param("id"), body)
        ),
      ),
      (value) => c.json(value, value.idempotentReplay ? 200 : 201),
    ));
  app.post("/me/client-runs/:id/abandon", isGranted("ROLE_USER"), (c) =>
    run(
      c,
      requestJson(c).pipe(
        Effect.flatMap((body) =>
          abandonClientRun(db, blobStore, c.get("currentUser")!.id, c.req.param("id"), body)
        ),
      ),
      (value) => c.json(value),
    ));
}

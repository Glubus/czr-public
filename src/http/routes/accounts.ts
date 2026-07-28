import { Effect } from "effect";
import { Hono } from "hono";
import { type AuthEnv, isGranted } from "../../auth/authorization.ts";
import type { Database } from "../../db/client.ts";
import type { BlobStore } from "../../infra/blob-store.ts";
import { maximumMediaBytes, parseMediaKind, uploadMedia } from "../../modules/media/service.ts";
import { deleteOwnAccount, updateOwnProfile } from "../../modules/accounts/service.ts";
import { pinProfileRecord, unpinProfileRecord } from "../../modules/accounts/pinned-records.ts";
import type { HttpEffectRunner } from "../route-support.ts";
import { problemResponse } from "../problem.ts";

type RequestJson = (context: Parameters<HttpEffectRunner>[0]) => Effect.Effect<unknown, unknown>;

export function registerAccountRoutes(
  app: Hono<AuthEnv>,
  db: Database,
  blobStore: BlobStore,
  run: HttpEffectRunner,
  requestJson: RequestJson,
) {
  app.post(
    "/me/media/:kind",
    isGranted("ROLE_USER"),
    async (c) => {
      const contentType = (c.req.header("content-type") ?? "").split(";", 1)[0]!.toLowerCase();
      let kind;
      try {
        kind = parseMediaKind(c.req.param("kind"));
      } catch (error) {
        return problemResponse(c, {
          status: 400,
          code: "validation_failed",
          detail: error instanceof Error ? error.message : "unknown media kind",
        });
      }
      const maximum = maximumMediaBytes(kind);
      const contentLength = c.req.header("content-length");
      if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maximum) {
        return mediaTooLarge(c, maximum);
      }
      let bytes: Uint8Array;
      try {
        bytes = await readBoundedBody(c.req.raw, maximum);
      } catch (error) {
        if (error instanceof MediaBodyTooLargeError) return mediaTooLarge(c, maximum);
        throw error;
      }
      return run(
        c,
        uploadMedia(db, blobStore, c.get("currentUser")!.id, kind, contentType, bytes),
        (value) => c.json(value, 201),
      );
    },
  );
  app.patch(
    "/me/profile",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => updateOwnProfile(db, c.get("currentUser")!.id, body))),
        (value) => c.json(value),
      ),
  );
  app.put(
    "/me/pinned-records/:submissionId",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        pinProfileRecord(db, c.get("currentUser")!.id, Number(c.req.param("submissionId"))),
        (value) => c.json(value),
      ),
  );
  app.delete(
    "/me/pinned-records/:submissionId",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        unpinProfileRecord(db, c.get("currentUser")!.id, Number(c.req.param("submissionId"))),
        (value) => c.json(value),
      ),
  );
  app.delete(
    "/me/account",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => deleteOwnAccount(db, c.get("currentUser")!.id, body))),
        (value) => c.json(value),
      ),
  );
}

class MediaBodyTooLargeError extends Error {}

async function readBoundedBody(request: Request, maximum: number) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const bytes = new Uint8Array(maximum);
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return bytes.subarray(0, length);
      if (length + value.byteLength > maximum) {
        await reader.cancel("media body exceeds configured limit");
        throw new MediaBodyTooLargeError();
      }
      bytes.set(value, length);
      length += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
}

function mediaTooLarge(context: Parameters<HttpEffectRunner>[0], maximum: number) {
  return problemResponse(context, {
    status: 413,
    code: "payload_too_large",
    detail: `Media body exceeds the ${maximum / 1024 / 1024} MB limit`,
  });
}

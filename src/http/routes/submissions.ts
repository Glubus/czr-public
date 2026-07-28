import { Effect } from "effect";
import { Hono } from "hono";
import { type AuthEnv, isGranted } from "../../auth/authorization.ts";
import type { Database } from "../../db/client.ts";
import {
  createSubmission,
  createSubmissionGroup,
  getSubmissionDetail,
  listOwnParticipationInvitations,
  listSubmissions,
  respondParticipationInvitation,
  reviewSubmission,
} from "../../modules/submissions/service.ts";
import {
  createSubmissionComment,
  deleteSubmissionComment,
  listSubmissionComments,
  voteSubmissionComment,
} from "../../modules/submissions/comments.ts";
import type { HttpEffectRunner } from "../route-support.ts";

type RequestJson = (context: Parameters<HttpEffectRunner>[0]) => Effect.Effect<unknown, unknown>;

function filters(request: { query(name: string): string | undefined }) {
  return {
    status: request.query("status"),
    mapId: request.query("mapId"),
    categoryId: request.query("categoryId"),
    groupId: request.query("groupId"),
    page: request.query("page"),
  };
}

/** Submission creation, personal history and moderation form a single workflow. */
export function registerSubmissionRoutes(
  app: Hono<AuthEnv>,
  db: Database,
  run: HttpEffectRunner,
  requestJson: RequestJson,
) {
  app.get(
    "/submissions/:id/comments",
    (c) =>
      run(
        c,
        listSubmissionComments(db, Number(c.req.param("id")), c.get("currentUser")?.id),
        (value) => c.json(value),
      ),
  );
  app.post(
    "/submissions/:id/comments",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(
          Effect.flatMap((body) =>
            createSubmissionComment(db, Number(c.req.param("id")), c.get("currentUser")!.id, body)
          ),
        ),
        (value) => c.json(value, 201),
      ),
  );
  app.delete(
    "/submissions/:id/comments/:commentId",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        deleteSubmissionComment(
          db,
          Number(c.req.param("id")),
          Number(c.req.param("commentId")),
          c.get("currentUser")!.id,
        ),
        (value) => c.json(value),
      ),
  );
  app.put(
    "/submissions/:id/comments/:commentId/vote",
    isGranted("ROLE_USER"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(
          Effect.flatMap((body) =>
            voteSubmissionComment(
              db,
              Number(c.req.param("id")),
              Number(c.req.param("commentId")),
              c.get("currentUser")!.id,
              body,
            )
          ),
        ),
        (value) => c.json(value),
      ),
  );
  app.post(
    "/submissions",
    isGranted("submission:create"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(Effect.flatMap((body) => createSubmission(db, body, c.get("currentUser")!.id))),
        (value) => c.json(value, 201),
      ),
  );
  app.post(
    "/submission-groups",
    isGranted("submission:create"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(
          Effect.flatMap((body) => createSubmissionGroup(db, body, c.get("currentUser")!.id)),
        ),
        (value) => c.json(value, 201),
      ),
  );
  app.patch(
    "/admin/submissions/:id/status",
    isGranted("submission:review"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(
          Effect.flatMap((body) =>
            reviewSubmission(db, Number(c.req.param("id")), body, c.get("currentUser")!.id)
          ),
        ),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/admin/submissions",
    isGranted("submission:review"),
    (c) => run(c, listSubmissions(db, filters(c.req)), (value) => c.json(value)),
  );
  app.get(
    "/admin/submissions/:id",
    isGranted("submission:review"),
    (c) => run(c, getSubmissionDetail(db, Number(c.req.param("id"))), (value) => c.json(value)),
  );
  app.get(
    "/me/submissions",
    isGranted("submission:create"),
    (c) => run(c, listSubmissions(db, filters(c.req), c.get("currentUser")!.id), (value) => c.json(value)),
  );
  app.get(
    "/me/participation-invitations",
    isGranted("submission:create"),
    (c) =>
      run(
        c,
        listOwnParticipationInvitations(db, c.get("currentUser")!.id),
        (value) => c.json(value),
      ),
  );
  app.patch(
    "/me/participation-invitations/:id",
    isGranted("submission:create"),
    (c) =>
      run(
        c,
        requestJson(c).pipe(
          Effect.flatMap((body) =>
            respondParticipationInvitation(
              db,
              Number(c.req.param("id")),
              c.get("currentUser")!.id,
              body,
            )
          ),
        ),
        (value) => c.json(value),
      ),
  );
}

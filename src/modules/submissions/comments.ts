import { and, asc, eq, sql } from "drizzle-orm";
import { Effect, Schema } from "effect";
import type { Database } from "../../db/client.ts";
import { submissionComments, submissionCommentVotes, submissions, users } from "../../db/schema.ts";
import { NotFoundError, ValidationError } from "../shared/errors.ts";

const CommentPayload = Schema.Struct({
  body: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(2_000)),
  parentId: Schema.optional(Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)))),
});
const VotePayload = Schema.Struct({ value: Schema.Literal(-1, 0, 1) });

export function listSubmissionComments(db: Database, submissionId: number, viewerId?: string) {
  return Effect.tryPromise({
    try: async () => {
      await requirePublicSubmission(db, submissionId);
      const comments = await db.select({
        id: submissionComments.id,
        parentId: submissionComments.parentId,
        body: submissionComments.body,
        createdAt: submissionComments.createdAt,
        updatedAt: submissionComments.updatedAt,
        author: { id: users.id, name: users.name, image: users.image },
      }).from(submissionComments)
        .innerJoin(users, eq(submissionComments.userId, users.id))
        .where(eq(submissionComments.submissionId, submissionId))
        .orderBy(asc(submissionComments.createdAt), asc(submissionComments.id));
      const voteTotals = await db.select({
        commentId: submissionCommentVotes.commentId,
        upvotes: sql<number>`count(*) FILTER (WHERE ${submissionCommentVotes.value} = 1)`,
        downvotes: sql<number>`count(*) FILTER (WHERE ${submissionCommentVotes.value} = -1)`,
        viewerVote: viewerId
          ? sql<number>`coalesce(max(CASE WHEN ${submissionCommentVotes.userId} = ${viewerId} THEN ${submissionCommentVotes.value} END), 0)`
          : sql<number>`0`,
      }).from(submissionCommentVotes).innerJoin(
        submissionComments,
        eq(submissionCommentVotes.commentId, submissionComments.id),
      ).where(eq(submissionComments.submissionId, submissionId))
        .groupBy(submissionCommentVotes.commentId);
      const totals = new Map(voteTotals.map((vote) => [
        vote.commentId,
        {
          upvotes: Number(vote.upvotes),
          downvotes: Number(vote.downvotes),
          viewerVote: Number(vote.viewerVote),
        },
      ]));
      return comments.map((comment) => {
        const total = totals.get(comment.id) ?? { upvotes: 0, downvotes: 0, viewerVote: 0 };
        return { ...comment, ...total, score: total.upvotes - total.downvotes };
      });
    },
    catch: (error) => error,
  });
}

export function createSubmissionComment(
  db: Database,
  submissionId: number,
  userId: string,
  payload: unknown,
) {
  return Schema.decodeUnknown(CommentPayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((decoded) =>
      Effect.tryPromise({
        try: async () => {
          await requirePublicSubmission(db, submissionId);
          const body = decoded.body.trim();
          if (!body) throw new ValidationError("comment cannot be empty");
          let parentId: number | null = null;
          if (decoded.parentId) {
            const [parent] = await db.select({
              id: submissionComments.id,
              parentId: submissionComments.parentId,
            }).from(submissionComments).where(and(
              eq(submissionComments.id, decoded.parentId),
              eq(submissionComments.submissionId, submissionId),
            )).limit(1);
            if (!parent) throw new NotFoundError("parent comment not found");
            parentId = parent.parentId ?? parent.id;
          }
          const [comment] = await db.insert(submissionComments).values({
            submissionId,
            userId,
            body,
            parentId,
          }).returning({
            id: submissionComments.id,
            parentId: submissionComments.parentId,
            body: submissionComments.body,
            createdAt: submissionComments.createdAt,
            updatedAt: submissionComments.updatedAt,
          });
          const [author] = await db.select({ id: users.id, name: users.name, image: users.image })
            .from(users).where(eq(users.id, userId)).limit(1);
          if (!comment || !author) throw new NotFoundError("user not found");
          return { ...comment, author, upvotes: 0, downvotes: 0, score: 0, viewerVote: 0 };
        },
        catch: (error) => error,
      })
    ),
  );
}

export function voteSubmissionComment(
  db: Database,
  submissionId: number,
  commentId: number,
  userId: string,
  payload: unknown,
) {
  return Schema.decodeUnknown(VotePayload)(payload).pipe(
    Effect.mapError((error) => new ValidationError(String(error))),
    Effect.flatMap((decoded) =>
      Effect.tryPromise({
        try: async () => {
          await requireComment(db, submissionId, commentId);
          if (decoded.value === 0) {
            await db.delete(submissionCommentVotes).where(and(
              eq(submissionCommentVotes.commentId, commentId),
              eq(submissionCommentVotes.userId, userId),
            ));
          } else {
            await db.insert(submissionCommentVotes).values({
              commentId,
              userId,
              value: decoded.value,
            }).onConflictDoUpdate({
              target: [submissionCommentVotes.commentId, submissionCommentVotes.userId],
              set: { value: decoded.value, updatedAt: new Date() },
            });
          }
          const [total] = await db.select({
            upvotes: sql<number>`count(*) FILTER (WHERE ${submissionCommentVotes.value} = 1)`,
            downvotes: sql<number>`count(*) FILTER (WHERE ${submissionCommentVotes.value} = -1)`,
          }).from(submissionCommentVotes).where(eq(submissionCommentVotes.commentId, commentId));
          const upvotes = Number(total?.upvotes ?? 0);
          const downvotes = Number(total?.downvotes ?? 0);
          return { commentId, upvotes, downvotes, score: upvotes - downvotes, viewerVote: decoded.value };
        },
        catch: (error) => error,
      })
    ),
  );
}

export function deleteSubmissionComment(
  db: Database,
  submissionId: number,
  commentId: number,
  userId: string,
) {
  return Effect.tryPromise({
    try: async () => {
      const [owned] = await db.select({ id: submissionComments.id }).from(submissionComments).where(and(
        eq(submissionComments.id, commentId),
        eq(submissionComments.submissionId, submissionId),
        eq(submissionComments.userId, userId),
      )).limit(1);
      if (!owned) throw new NotFoundError("comment not found");
      await db.transaction(async (transaction) => {
        await transaction.update(submissionComments).set({ parentId: null }).where(
          eq(submissionComments.parentId, commentId),
        );
        await transaction.delete(submissionComments).where(eq(submissionComments.id, commentId));
      });
      return { deleted: true };
    },
    catch: (error) => error,
  });
}

async function requirePublicSubmission(db: Database, submissionId: number) {
  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    throw new NotFoundError("submission not found");
  }
  const [submission] = await db.select({ id: submissions.id }).from(submissions).where(and(
    eq(submissions.id, submissionId),
    eq(submissions.status, "verified"),
  )).limit(1);
  if (!submission) throw new NotFoundError("submission not found");
}

async function requireComment(db: Database, submissionId: number, commentId: number) {
  await requirePublicSubmission(db, submissionId);
  const [comment] = await db.select({ id: submissionComments.id }).from(submissionComments).where(and(
    eq(submissionComments.id, commentId),
    eq(submissionComments.submissionId, submissionId),
  )).limit(1);
  if (!comment) throw new NotFoundError("comment not found");
}

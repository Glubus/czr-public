import { and, desc, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import type { Database } from "../../db/client.ts";
import {
  bestRecords,
  categories,
  games,
  maps,
  submissionParticipants,
  submissionProofs,
  submissions,
  users,
} from "../../db/schema.ts";
import { NotFoundError, ValidationError } from "../shared/errors.ts";

const SUBMISSIONS_PAGE_SIZE = 25;

type SubmissionListQuery = {
  submissionId?: string;
  status?: string;
  mapId?: string;
  categoryId?: string;
  groupId?: string;
  page?: string;
};

export function listSubmissions(db: Database, query: SubmissionListQuery, participantUserId?: string) {
  return parseSubmissionListQuery(query).pipe(
    Effect.flatMap((filters) =>
      Effect.tryPromise({
        try: async () => {
          const conditions = [];
          if (filters.submissionId) conditions.push(eq(submissions.id, filters.submissionId));
          if (filters.status) conditions.push(eq(submissions.status, filters.status));
          if (filters.mapId) conditions.push(eq(submissions.mapId, filters.mapId));
          if (filters.categoryId) conditions.push(eq(submissions.categoryId, filters.categoryId));
          if (filters.groupId) conditions.push(eq(submissions.submissionGroupId, filters.groupId));

          const base = db.select({
            submission: submissions,
            game: { id: games.id, slug: games.slug, name: games.name },
            map: { id: maps.id, slug: maps.slug, name: maps.name, type: maps.type },
            category: {
              id: categories.id,
              slug: categories.slug,
              name: categories.name,
              scoreType: categories.scoreType,
              rankingDirection: categories.rankingDirection,
            },
            submitter: { id: users.id, name: users.name, image: users.image },
            points: bestRecords.points,
          }).from(submissions).innerJoin(games, eq(submissions.gameId, games.id))
            .innerJoin(maps, eq(submissions.mapId, maps.id))
            .innerJoin(categories, eq(submissions.categoryId, categories.id))
            .innerJoin(users, eq(submissions.userId, users.id))
            .leftJoin(bestRecords, eq(submissions.id, bestRecords.submissionId));
          const rawRows = participantUserId
            ? await base.innerJoin(
              submissionParticipants,
              eq(submissions.id, submissionParticipants.submissionId),
            ).where(and(
              ...conditions,
              eq(submissionParticipants.userId, participantUserId),
              eq(submissionParticipants.status, "accepted"),
            ))
              .orderBy(desc(submissions.submittedAt), desc(submissions.id))
              .limit(SUBMISSIONS_PAGE_SIZE + 1)
              .offset(filters.page * SUBMISSIONS_PAGE_SIZE)
            : await base.where(conditions.length > 0 ? and(...conditions) : undefined)
              .orderBy(desc(submissions.submittedAt), desc(submissions.id))
              .limit(SUBMISSIONS_PAGE_SIZE + 1)
              .offset(filters.page * SUBMISSIONS_PAGE_SIZE);
          const rows = rawRows.slice(0, SUBMISSIONS_PAGE_SIZE);
          const submissionIds = rows.map((row) => row.submission.id);
          const participantRows = submissionIds.length === 0 ? [] : await db.select({
            submissionId: submissionParticipants.submissionId,
            role: submissionParticipants.role,
            status: submissionParticipants.status,
            acceptanceSource: submissionParticipants.acceptanceSource,
            acceptanceClanId: submissionParticipants.acceptanceClanId,
            respondedAt: submissionParticipants.respondedAt,
            user: { id: users.id, name: users.name, image: users.image },
          }).from(submissionParticipants).innerJoin(users, eq(submissionParticipants.userId, users.id))
            .where(inArray(submissionParticipants.submissionId, submissionIds));
          const proofRows = submissionIds.length === 0 ? [] : await db.select().from(submissionProofs).where(
            inArray(submissionProofs.submissionId, submissionIds),
          );
          const participantsBySubmission = Map.groupBy(participantRows, (row) => row.submissionId);
          const proofsBySubmission = Map.groupBy(proofRows, (row) => row.submissionId);
          return {
            page: filters.page,
            pageSize: SUBMISSIONS_PAGE_SIZE,
            hasMore: rawRows.length > SUBMISSIONS_PAGE_SIZE,
            entries: rows.map((row) => ({
              ...row,
              participants: participantsBySubmission.get(row.submission.id) ?? [],
              proofs: proofsBySubmission.get(row.submission.id) ?? [],
            })),
          };
        },
        catch: (error) => error,
      })
    ),
  );
}

export function getSubmissionDetail(db: Database, submissionId: number) {
  return listSubmissions(db, { submissionId: String(submissionId), page: "0" }).pipe(
    Effect.flatMap((result) =>
      result.entries[0]
        ? Effect.succeed(result.entries[0])
        : Effect.fail(new NotFoundError("submission not found"))
    ),
  );
}

export function getPublicSubmissionDetail(db: Database, submissionId: number) {
  return listSubmissions(db, { submissionId: String(submissionId), status: "verified", page: "0" }).pipe(
    Effect.flatMap((result) => {
      const entry = result.entries[0];
      if (!entry) return Effect.fail(new NotFoundError("submission not found"));
      const { reviewNote: _reviewNote, submittedBy: _submittedBy, verifiedBy: _verifiedBy, ...submission } =
        entry.submission;
      return Effect.succeed({ ...entry, submission });
    }),
  );
}

function parseSubmissionListQuery(query: SubmissionListQuery) {
  return Effect.try({
    try: () => {
      const parseId = (value: string | undefined, name: string) => {
        if (value === undefined) return undefined;
        if (!/^[1-9][0-9]*$/.test(value)) throw new ValidationError(`${name} must be a positive integer`);
        return Number(value);
      };
      const statuses = ["awaiting_participants", "pending", "verified", "rejected", "cancelled"] as const;
      if (query.status !== undefined && !statuses.includes(query.status as typeof statuses[number])) {
        throw new ValidationError(
          "status must be awaiting_participants, pending, verified, rejected, or cancelled",
        );
      }
      if (query.page !== undefined && !/^[0-9]+$/.test(query.page)) {
        throw new ValidationError("page must be a non-negative integer");
      }
      if (
        query.groupId !== undefined &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query.groupId)
      ) {
        throw new ValidationError("groupId must be a UUID");
      }
      return {
        submissionId: parseId(query.submissionId, "submissionId"),
        status: query.status as typeof statuses[number] | undefined,
        mapId: parseId(query.mapId, "mapId"),
        categoryId: parseId(query.categoryId, "categoryId"),
        groupId: query.groupId,
        page: query.page === undefined ? 0 : Number(query.page),
      };
    },
    catch: (error) => error,
  });
}

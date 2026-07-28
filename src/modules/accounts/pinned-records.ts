import { and, count, eq } from "drizzle-orm";
import { Effect } from "effect";
import type { Database } from "../../db/client.ts";
import { bestRecords, profilePinnedRecords, submissionParticipants, submissions } from "../../db/schema.ts";
import { ConflictError, NotFoundError, ValidationError } from "../shared/errors.ts";

const MAX_PINNED_RECORDS = 3;

export function pinProfileRecord(db: Database, userId: string, submissionId: number) {
  return Effect.tryPromise({
    try: async () => {
      assertSubmissionId(submissionId);
      const [eligible] = await db.select({ submissionId: submissions.id })
        .from(submissions)
        .innerJoin(bestRecords, eq(bestRecords.submissionId, submissions.id))
        .innerJoin(
          submissionParticipants,
          and(
            eq(submissionParticipants.submissionId, submissions.id),
            eq(submissionParticipants.userId, userId),
            eq(submissionParticipants.isPersonalBest, true),
          ),
        )
        .where(and(eq(submissions.id, submissionId), eq(submissions.status, "verified")))
        .limit(1);
      if (!eligible) throw new NotFoundError("current personal best record not found");

      const [alreadyPinned] = await db.select({ submissionId: profilePinnedRecords.submissionId })
        .from(profilePinnedRecords)
        .where(and(
          eq(profilePinnedRecords.userId, userId),
          eq(profilePinnedRecords.submissionId, submissionId),
        ))
        .limit(1);
      if (alreadyPinned) return { pinned: true, submissionId };

      const [total] = await db.select({ value: count() }).from(profilePinnedRecords)
        .innerJoin(bestRecords, eq(bestRecords.submissionId, profilePinnedRecords.submissionId))
        .innerJoin(
          submissionParticipants,
          and(
            eq(submissionParticipants.submissionId, profilePinnedRecords.submissionId),
            eq(submissionParticipants.userId, userId),
            eq(submissionParticipants.isPersonalBest, true),
          ),
        )
        .where(eq(profilePinnedRecords.userId, userId));
      if (Number(total?.value ?? 0) >= MAX_PINNED_RECORDS) {
        throw new ConflictError(`a profile can pin at most ${MAX_PINNED_RECORDS} records`);
      }

      await db.insert(profilePinnedRecords).values({ userId, submissionId });
      return { pinned: true, submissionId };
    },
    catch: (error) => error,
  });
}

export function unpinProfileRecord(db: Database, userId: string, submissionId: number) {
  return Effect.tryPromise({
    try: async () => {
      assertSubmissionId(submissionId);
      const [removed] = await db.delete(profilePinnedRecords).where(and(
        eq(profilePinnedRecords.userId, userId),
        eq(profilePinnedRecords.submissionId, submissionId),
      )).returning({ submissionId: profilePinnedRecords.submissionId });
      if (!removed) throw new NotFoundError("pinned record not found");
      return { pinned: false, submissionId };
    },
    catch: (error) => error,
  });
}

function assertSubmissionId(value: number) {
  if (!Number.isSafeInteger(value) || value < 1) throw new ValidationError("submissionId is invalid");
}

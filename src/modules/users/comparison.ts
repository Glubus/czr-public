import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { Effect } from "effect";
import type { Database } from "../../db/client.ts";
import {
  bestRecords,
  categories,
  follows,
  games,
  maps,
  submissionParticipants,
  submissions,
  users,
} from "../../db/schema.ts";
import { NotFoundError, ValidationError } from "../shared/errors.ts";
import { isBetterRecord } from "../submissions/ranking.ts";

export function compareUsers(db: Database, userId: string, otherUserId: string) {
  return Effect.tryPromise({
    try: async () => {
      if (userId === otherUserId) throw new ValidationError("two different users are required");
      const comparedUsers = await db.select({
        id: users.id,
        name: users.name,
        image: users.image,
        performancePoints: users.performancePoints,
      }).from(users).where(and(inArray(users.id, [userId, otherUserId]), isNull(users.deletedAt)));
      const leftUser = comparedUsers.find((user) => user.id === userId);
      const rightUser = comparedUsers.find((user) => user.id === otherUserId);
      if (!leftUser || !rightUser) throw new NotFoundError("user not found");

      const [records, ranks, followRows, recentRuns] = await Promise.all([
        loadComparisonRecords(db, [userId, otherUserId]),
        loadGlobalRanks(db),
        db.select({ followerUserId: follows.followerUserId, targetId: follows.targetId }).from(follows)
          .where(and(
            eq(follows.targetType, "user"),
            inArray(follows.followerUserId, [userId, otherUserId]),
            inArray(follows.targetId, [userId, otherUserId]),
          )),
        loadRecentRuns(db, [userId, otherUserId]),
      ]);

      const byUser = Map.groupBy(records, (record) => record.userId);
      const leftRecords = bestByBoard(byUser.get(userId) ?? []);
      const rightRecords = bestByBoard(byUser.get(otherUserId) ?? []);
      const commonKeys = [...leftRecords.keys()].filter((key) => rightRecords.has(key)).sort();
      let leftWins = 0;
      let rightWins = 0;
      let ties = 0;
      const commonBoards = commonKeys.map((key) => {
        const left = leftRecords.get(key)!;
        const right = rightRecords.get(key)!;
        const leftBetter = isBetterRecord(
          left.scoreValue,
          right.scoreValue,
          left.runDurationMs,
          right.runDurationMs,
          left.category.scoreType,
          left.category.rankingDirection,
        );
        const rightBetter = isBetterRecord(
          right.scoreValue,
          left.scoreValue,
          right.runDurationMs,
          left.runDurationMs,
          left.category.scoreType,
          left.category.rankingDirection,
        );
        const winnerUserId = leftBetter ? userId : rightBetter ? otherUserId : null;
        if (winnerUserId === userId) leftWins++;
        else if (winnerUserId === otherUserId) rightWins++;
        else ties++;
        return {
          boardKey: key,
          game: left.game,
          map: left.map,
          category: left.category,
          categoryAssignmentId: left.categoryAssignmentId,
          playerCount: left.playerCount,
          winnerUserId,
          left: publicRecord(left),
          right: publicRecord(right),
        };
      });

      const leftFollowsRight = followRows.some((follow) =>
        follow.followerUserId === userId && follow.targetId === otherUserId
      );
      const rightFollowsLeft = followRows.some((follow) =>
        follow.followerUserId === otherUserId && follow.targetId === userId
      );
      const sharedTeams = sharedTeamKeys(records, userId, otherUserId);
      const commonMapCount = new Set(commonBoards.map((board) => board.map.id)).size;
      const commonCategoryCount = new Set(commonBoards.map((board) => board.category.id)).size;

      return {
        left: {
          user: leftUser,
          globalRank: ranks.get(userId)!,
          recordCount: leftRecords.size,
          recentRuns: recentRuns.filter((run) => run.userId === userId).map(stripUserId),
        },
        right: {
          user: rightUser,
          globalRank: ranks.get(otherUserId)!,
          recordCount: rightRecords.size,
          recentRuns: recentRuns.filter((run) => run.userId === otherUserId).map(stripUserId),
        },
        friendship: {
          leftFollowsRight,
          rightFollowsLeft,
          mutual: leftFollowsRight && rightFollowsLeft,
        },
        headToHead: { leftWins, rightWins, ties, commonMapCount, commonCategoryCount },
        commonBoards,
        sharedTeams,
      };
    },
    catch: (error) => error,
  });
}

function loadComparisonRecords(db: Database, userIds: string[]) {
  return db.select({
    userId: submissionParticipants.userId,
    submissionId: submissions.id,
    competitorKey: submissions.competitorKey,
    scoreValue: submissions.scoreValue,
    runDurationMs: submissions.runDurationMs,
    playerCount: submissions.playerCount,
    categoryAssignmentId: submissions.categoryAssignmentId,
    verifiedAt: submissions.verifiedAt,
    points: bestRecords.points,
    game: { id: games.id, slug: games.slug, name: games.name },
    map: { id: maps.id, slug: maps.slug, name: maps.name },
    category: {
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      scoreType: categories.scoreType,
      rankingDirection: categories.rankingDirection,
    },
  }).from(submissionParticipants)
    .innerJoin(bestRecords, eq(submissionParticipants.submissionId, bestRecords.submissionId))
    .innerJoin(submissions, eq(bestRecords.submissionId, submissions.id))
    .innerJoin(games, eq(submissions.gameId, games.id))
    .innerJoin(maps, eq(submissions.mapId, maps.id))
    .innerJoin(categories, eq(submissions.categoryId, categories.id))
    .where(and(
      inArray(submissionParticipants.userId, userIds),
      eq(submissionParticipants.isPersonalBest, true),
    ));
}

async function loadGlobalRanks(db: Database) {
  const rows = await db.select({ id: users.id }).from(users).where(isNull(users.deletedAt))
    .orderBy(desc(users.performancePoints), users.id);
  return new Map(rows.map((user, index) => [user.id, index + 1]));
}

async function loadRecentRuns(db: Database, userIds: string[]) {
  const perUser = await Promise.all(userIds.map((userId) =>
    db.select({
      userId: submissionParticipants.userId,
      submissionId: submissions.id,
      scoreValue: submissions.scoreValue,
      runDurationMs: submissions.runDurationMs,
      playerCount: submissions.playerCount,
      verifiedAt: submissions.verifiedAt,
      map: { id: maps.id, slug: maps.slug, name: maps.name },
      category: { id: categories.id, slug: categories.slug, name: categories.name },
    }).from(submissionParticipants)
      .innerJoin(submissions, eq(submissionParticipants.submissionId, submissions.id))
      .innerJoin(maps, eq(submissions.mapId, maps.id))
      .innerJoin(categories, eq(submissions.categoryId, categories.id))
      .where(and(eq(submissionParticipants.userId, userId), eq(submissions.status, "verified")))
      .orderBy(desc(submissions.verifiedAt), desc(submissions.id))
      .limit(10)
  ));
  return perUser.flat();
}

function bestByBoard(records: Awaited<ReturnType<typeof loadComparisonRecords>>) {
  const result = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    const key = boardKey(record);
    const current = result.get(key);
    if (
      !current || isBetterRecord(
        record.scoreValue,
        current.scoreValue,
        record.runDurationMs,
        current.runDurationMs,
        record.category.scoreType,
        record.category.rankingDirection,
      )
    ) result.set(key, record);
  }
  return result;
}

function boardKey(record: { map: { id: number }; categoryAssignmentId: number | null; playerCount: number }) {
  return `${record.map.id}:${record.categoryAssignmentId}:${record.playerCount}`;
}

function publicRecord(record: Awaited<ReturnType<typeof loadComparisonRecords>>[number]) {
  return {
    submissionId: record.submissionId,
    scoreValue: record.scoreValue,
    runDurationMs: record.runDurationMs,
    points: record.points,
    verifiedAt: record.verifiedAt,
  };
}

function sharedTeamKeys(
  records: Awaited<ReturnType<typeof loadComparisonRecords>>,
  leftUserId: string,
  rightUserId: string,
) {
  const membersByTeam = new Map<string, Set<string>>();
  for (const record of records) {
    if (record.playerCount < 2 || !record.competitorKey.startsWith("team:")) continue;
    const members = membersByTeam.get(record.competitorKey) ?? new Set<string>();
    members.add(record.userId);
    membersByTeam.set(record.competitorKey, members);
  }
  return [...membersByTeam].filter(([, members]) => members.has(leftUserId) && members.has(rightUserId))
    .map(([competitorKey]) => competitorKey).sort();
}

function stripUserId<T extends { userId: string }>(value: T): Omit<T, "userId"> {
  const { userId: _userId, ...rest } = value;
  return rest;
}

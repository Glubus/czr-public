export type RankingDirection = "higher_is_better" | "lower_is_better";

/** Compares two records without knowing anything about HTTP or persistence. */
export function isBetterRecord(
  candidate: number,
  current: number,
  candidateDurationMs: number | null,
  currentDurationMs: number | null,
  scoreType: string,
  direction: RankingDirection,
) {
  if (candidate !== current) {
    return direction === "higher_is_better" ? candidate > current : candidate < current;
  }
  if (scoreType !== "round" || candidateDurationMs === null) return false;
  return currentDurationMs === null || candidateDurationMs < currentDurationMs;
}

export function leaderboardPool(playerCount: number) {
  return Number((50 + 150 * Math.sqrt(Math.max(0, playerCount - 1))).toFixed(2));
}

export type LeaderboardRecord = {
  submissionId: number;
  userId: string;
  scoreValue: number;
  runDurationMs: number | null;
  proofLevel: string;
  proofUrl: string | null;
  submittedAt: Date;
  userName: string;
  userImage: string | null;
  points?: number;
};

/** Shapes persisted best records into the stable public leaderboard representation. */
export function rankLeaderboardRecords(
  rows: ReadonlyArray<LeaderboardRecord>,
  direction: RankingDirection,
  pool: number,
) {
  const wrScore = rows[0]?.scoreValue ?? 1;
  return rows.map((row, index) => {
    const rank = index + 1;
    const wrProximity = direction === "higher_is_better"
      ? row.scoreValue / Math.max(1, wrScore)
      : Math.max(1, wrScore) / Math.max(1, row.scoreValue);
    // Reward both closeness to the WR and leaderboard placement strongly enough
    // that one dense board cannot fill the global highest-record list.
    const rankFactor = 1 / Math.pow(rank, 0.15);
    const podiumBonus = 1;
    const points = row.points ?? Number((pool * Math.pow(wrProximity, 3) * rankFactor).toFixed(2));
    return {
      rank,
      submission: {
        id: row.submissionId,
        scoreValue: row.scoreValue,
        runDurationMs: row.runDurationMs,
        proofLevel: row.proofLevel,
        proofUrl: row.proofUrl,
        submittedAt: row.submittedAt,
      },
      userId: row.userId,
      user: { id: row.userId, name: row.userName, image: row.userImage },
      scoreValue: row.scoreValue,
      proofLevel: row.proofLevel,
      points,
      pointFormulaVersion: "v5-strong-falloff",
      pointBreakdown: {
        pool,
        wrProximity: Number(wrProximity.toFixed(4)),
        rankFactor: Number(rankFactor.toFixed(4)),
        podiumBonus,
      },
    };
  });
}

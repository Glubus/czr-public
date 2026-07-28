import { sql } from "drizzle-orm";
import type { Database } from "../../db/client.ts";

export type CommunityMetricRow = {
  userId: string;
  communityRecords: number;
  communityBestRank: number | null;
};

export type Bo3GumTrioMetricRow = {
  userId: string;
  bestRank: number;
};

export type CompetitiveMetricRow = {
  userId: string;
  podiumRecords: number;
  jackOfAllTradesTop3: number;
  gameSpecialistRecords: number;
  mapDominationBestRank: number | null;
  worldRecordGames: number;
  formatSweepBestRank: number | null;
  speedrunLadderBestRank: number | null;
  noCrutchesBestRank: number | null;
  cleanExtractionBestRank: number | null;
  doubleAgentBestRank: number | null;
  restrictedArsenalBestRank: number | null;
  hardcoreCredentialsBestRank: number | null;
  firstRoomOfficialRound: number | null;
  flawlessOfficialRound: number | null;
  extinctionProtocolBestRank: number | null;
  enduranceBestRank: number | null;
  bo3ResetMaps: number;
};

export type TeamworkMetricRow = {
  userId: string;
  dynamicDuoRecords: number;
  dynamicDuoWorldRecords: number;
  distinctTop3Partners: number;
  distinctTop1Partners: number;
};

export type HistoricalWorldRecordMetricRow = {
  userId: string;
  backFromTheDead: number;
  duoSelfSnipe: number;
  selfWorldRecordImprovement: number;
  wrWeekend: number;
  longestReignDays: number;
  recordBreakerDays: number;
};

type MetricQuery<T> = {
  load: (db: Database, userId?: string) => Promise<T[]>;
};

function participantFilter(userId?: string) {
  return userId ? sql`AND participant.user_id = ${userId}` : sql``;
}

function nullableNumber(value: number | null | undefined) {
  return value === null || value === undefined ? null : Number(value);
}

const community: MetricQuery<CommunityMetricRow> = {
  async load(db, userId) {
    const rows = await db.execute<{
      user_id: string;
      community_records: number;
      community_best_rank: number | null;
    }>(sql`
      WITH ranked_records AS (
        SELECT runs.id AS submission_id,
          row_number() OVER (
            PARTITION BY runs.map_id, runs.category_id, runs.category_assignment_id, runs.player_count
            ORDER BY
              CASE WHEN category.score_type = 'round' OR category.ranking_direction = 'higher_is_better'
                THEN runs.score_value END DESC NULLS LAST,
              CASE WHEN category.score_type <> 'round' AND category.ranking_direction = 'lower_is_better'
                THEN runs.score_value END ASC NULLS LAST,
              CASE WHEN category.score_type = 'round' THEN runs.run_duration_ms END ASC NULLS LAST,
              runs.verified_at ASC, runs.id ASC
          ) AS board_rank
        FROM best_records records
        JOIN submissions runs ON runs.id = records.submission_id
        JOIN categories category ON category.id = runs.category_id
        JOIN maps map ON map.id = runs.map_id
        WHERE runs.status = 'verified' AND map.type IN ('custom', 'uem')
      )
      SELECT participant.user_id,
        count(distinct ranked.submission_id)::int AS community_records,
        min(ranked.board_rank)::int AS community_best_rank
      FROM ranked_records ranked
      JOIN submission_participants participant ON participant.submission_id = ranked.submission_id
      WHERE participant.status = 'accepted' ${participantFilter(userId)}
      GROUP BY participant.user_id
    `);
    return rows.map((row) => ({
      userId: row.user_id,
      communityRecords: Number(row.community_records),
      communityBestRank: row.community_best_rank === null ? null : Number(row.community_best_rank),
    }));
  },
};

const bo3GumTrio: MetricQuery<Bo3GumTrioMetricRow> = {
  async load(db, userId) {
    const rows = await db.execute<{ user_id: string; best_rank: number }>(sql`
      WITH gum_records AS (
        SELECT runs.id AS submission_id,
          runs.map_id,
          runs.category_id,
          runs.player_count,
          CASE
            WHEN assignment.specific_rules->>'zwrSubrecord' = 'no-gobblegum'
              OR assignment.specific_rules->>'zwrSubrecord' LIKE '%-no-gobblegum'
              THEN 'no-gum'
            WHEN assignment.specific_rules->>'zwrSubrecord' = 'classic-gobblegum'
              OR assignment.specific_rules->>'zwrSubrecord' LIKE '%-classic-gobblegum'
              THEN 'classic-gum'
            WHEN assignment.specific_rules->>'zwrSubrecord' IN ('all-gobblegum', 'mega-gums')
              OR assignment.specific_rules->>'zwrSubrecord' LIKE '%-all-gobblegum'
              THEN 'mega-gum'
          END AS gum_type,
          row_number() OVER (
            PARTITION BY runs.category_assignment_id, runs.player_count
            ORDER BY
              CASE WHEN category.score_type = 'round' OR category.ranking_direction = 'higher_is_better'
                THEN runs.score_value END DESC NULLS LAST,
              CASE WHEN category.score_type <> 'round' AND category.ranking_direction = 'lower_is_better'
                THEN runs.score_value END ASC NULLS LAST,
              CASE WHEN category.score_type = 'round' THEN runs.run_duration_ms END ASC NULLS LAST,
              runs.verified_at ASC, runs.id ASC
          ) AS board_rank
        FROM best_records records
        JOIN submissions runs ON runs.id = records.submission_id
        JOIN category_assignments assignment ON assignment.id = runs.category_assignment_id
        JOIN categories category ON category.id = runs.category_id
        JOIN games game ON game.id = runs.game_id
        WHERE runs.status = 'verified'
          AND game.slug = 'bo3'
          AND (
            assignment.specific_rules->>'zwrSubrecord' IN (
              'no-gobblegum', 'classic-gobblegum', 'all-gobblegum', 'mega-gums'
            )
            OR assignment.specific_rules->>'zwrSubrecord' LIKE '%-no-gobblegum'
            OR assignment.specific_rules->>'zwrSubrecord' LIKE '%-classic-gobblegum'
            OR assignment.specific_rules->>'zwrSubrecord' LIKE '%-all-gobblegum'
          )
      ),
      player_sets AS (
        SELECT participant.user_id,
          gum.map_id,
          gum.category_id,
          gum.player_count,
          max(gum.board_rank)::int AS worst_rank
        FROM gum_records gum
        JOIN submission_participants participant ON participant.submission_id = gum.submission_id
        WHERE participant.status = 'accepted'
          AND gum.gum_type IS NOT NULL
          ${participantFilter(userId)}
        GROUP BY participant.user_id, gum.map_id, gum.category_id, gum.player_count
        HAVING count(distinct gum.gum_type) = 3
      )
      SELECT user_id, min(worst_rank)::int AS best_rank
      FROM player_sets
      GROUP BY user_id
    `);
    return rows.map((row) => ({ userId: row.user_id, bestRank: Number(row.best_rank) }));
  },
};

const competitive: MetricQuery<CompetitiveMetricRow> = {
  async load(db, userId) {
    const rows = await db.execute<{
      user_id: string;
      podium_records: number;
      jack_of_all_trades_top3: number;
      game_specialist_records: number;
      map_domination_best_rank: number | null;
      world_record_games: number;
      format_sweep_best_rank: number | null;
      speedrun_ladder_best_rank: number | null;
      no_crutches_best_rank: number | null;
      clean_extraction_best_rank: number | null;
      double_agent_best_rank: number | null;
      restricted_arsenal_best_rank: number | null;
      hardcore_credentials_best_rank: number | null;
      first_room_official_round: number | null;
      flawless_official_round: number | null;
      extinction_protocol_best_rank: number | null;
      endurance_best_rank: number | null;
      bo3_reset_maps: number;
    }>(sql`
      WITH ranked_records AS (
        SELECT runs.id AS submission_id,
          runs.game_id,
          game.slug AS game_slug,
          runs.map_id,
          map.type AS map_type,
          runs.category_id,
          runs.category_assignment_id,
          runs.player_count,
          runs.score_value,
          category.slug AS category_slug,
          assignment.specific_rules ->> 'zwrSubrecord' AS variant,
          row_number() OVER (
            PARTITION BY runs.map_id, runs.category_id, runs.category_assignment_id, runs.player_count
            ORDER BY
              CASE WHEN category.score_type = 'round' OR category.ranking_direction = 'higher_is_better'
                THEN runs.score_value END DESC NULLS LAST,
              CASE WHEN category.score_type <> 'round' AND category.ranking_direction = 'lower_is_better'
                THEN runs.score_value END ASC NULLS LAST,
              CASE WHEN category.score_type = 'round' THEN runs.run_duration_ms END ASC NULLS LAST,
              runs.verified_at ASC, runs.id ASC
          ) AS board_rank
        FROM best_records records
        JOIN submissions runs ON runs.id = records.submission_id
        JOIN categories category ON category.id = runs.category_id
        JOIN games game ON game.id = runs.game_id
        JOIN maps map ON map.id = runs.map_id
        LEFT JOIN category_assignments assignment ON assignment.id = runs.category_assignment_id
        WHERE runs.status = 'verified'
      ),
      owned AS (
        SELECT participant.user_id, ranked.*
        FROM ranked_records ranked
        JOIN submission_participants participant ON participant.submission_id = ranked.submission_id
        WHERE participant.status = 'accepted' ${participantFilter(userId)}
      ),
      base AS (
        SELECT user_id,
          count(distinct submission_id) FILTER (WHERE board_rank <= 3)::int AS podium_records,
          count(distinct game_id) FILTER (WHERE board_rank = 1)::int AS world_record_games,
          max(score_value) FILTER (
            WHERE game_slug IN ('bo', 'bo2', 'bo3')
              AND map_type = 'official' AND category_slug = 'first-room'
          )::int AS first_room_official_round,
          max(score_value) FILTER (
            WHERE game_slug IN ('bo', 'bo2', 'bo3')
              AND map_type = 'official' AND category_slug = 'flawless'
          )::int AS flawless_official_round,
          min(board_rank) FILTER (
            WHERE category_slug IN ('200-speedrun', '255-speedrun')
          )::int AS endurance_best_rank,
          count(distinct map_id) FILTER (
            WHERE game_slug = 'bo3' AND category_slug = 'high-round' AND score_value >= 255
          )::int AS bo3_reset_maps
        FROM owned
        GROUP BY user_id
      ),
      format_sweeps AS (
        SELECT user_id, min(worst_rank)::int AS best_rank
        FROM (
          SELECT user_id, map_id, category_assignment_id, max(best_rank)::int AS worst_rank
          FROM (
            SELECT user_id, map_id, category_assignment_id, player_count,
              min(board_rank)::int AS best_rank
            FROM owned
            WHERE player_count BETWEEN 1 AND 4
            GROUP BY user_id, map_id, category_assignment_id, player_count
          ) progress
          GROUP BY user_id, map_id, category_assignment_id
          HAVING count(*) = 4
        ) candidates
        GROUP BY user_id
      ),
      speedrun_ladders AS (
        SELECT user_id, min(worst_rank)::int AS best_rank
        FROM (
          SELECT user_id, map_id, max(best_rank)::int AS worst_rank
          FROM (
            SELECT user_id, map_id, category_slug, min(board_rank)::int AS best_rank
            FROM owned
            WHERE category_slug IN ('30-speedrun', '50-speedrun', '70-speedrun', '100-speedrun')
            GROUP BY user_id, map_id, category_slug
          ) progress
          GROUP BY user_id, map_id
          HAVING count(*) = 4
        ) candidates
        GROUP BY user_id
      ),
      no_crutches AS (
        SELECT user_id, min(worst_rank)::int AS best_rank
        FROM (
          SELECT user_id, map_id, max(best_rank)::int AS worst_rank
          FROM (
            SELECT user_id, map_id,
              CASE WHEN category_slug = 'bo2-no-jug' THEN 'no-jug' ELSE category_slug END AS family,
              min(board_rank)::int AS best_rank
            FROM owned
            WHERE category_slug IN ('no-power', 'no-perks', 'no-jug', 'bo2-no-jug')
            GROUP BY user_id, map_id,
              CASE WHEN category_slug = 'bo2-no-jug' THEN 'no-jug' ELSE category_slug END
          ) progress
          GROUP BY user_id, map_id
          HAVING count(*) = 3
        ) candidates
        GROUP BY user_id
      ),
      clean_extractions AS (
        SELECT user_id, min(worst_rank)::int AS best_rank
        FROM (
          SELECT user_id, map_id, max(best_rank)::int AS worst_rank
          FROM (
            SELECT user_id, map_id, variant, min(board_rank)::int AS best_rank
            FROM owned
            WHERE category_slug = 'exfil-speedrun' AND variant IN ('round-11', 'round-21')
            GROUP BY user_id, map_id, variant
          ) progress
          GROUP BY user_id, map_id
          HAVING count(*) = 2
        ) candidates
        GROUP BY user_id
      ),
      double_agents AS (
        SELECT user_id, min(worst_rank)::int AS best_rank
        FROM (
          SELECT user_id, map_id, max(best_rank)::int AS worst_rank
          FROM (
            SELECT user_id, map_id,
              CASE
                WHEN variant LIKE 'richtofen%' THEN 'richtofen'
                WHEN variant LIKE 'maxis%' THEN 'maxis'
              END AS family,
              min(board_rank)::int AS best_rank
            FROM owned
            WHERE game_slug = 'bo2' AND category_slug = 'ee-speedrun'
              AND (variant LIKE 'richtofen%' OR variant LIKE 'maxis%')
            GROUP BY user_id, map_id,
              CASE
                WHEN variant LIKE 'richtofen%' THEN 'richtofen'
                WHEN variant LIKE 'maxis%' THEN 'maxis'
              END
          ) progress
          GROUP BY user_id, map_id
          HAVING count(*) = 2
        ) candidates
        GROUP BY user_id
      ),
      restricted_arsenals AS (
        SELECT user_id, min(worst_rank)::int AS best_rank
        FROM (
          SELECT user_id, map_id, max(best_rank)::int AS worst_rank
          FROM (
            SELECT user_id, map_id, category_slug, min(board_rank)::int AS best_rank
            FROM owned
            WHERE game_slug = 'mw3'
              AND category_slug IN (
                'high-round-survival',
                'no-guns-survival',
                'pistols-only-survival'
              )
            GROUP BY user_id, map_id, category_slug
          ) progress
          GROUP BY user_id, map_id
          HAVING count(*) = 3
        ) candidates
        GROUP BY user_id
      ),
      hardcore_credentials AS (
        SELECT user_id, min(worst_rank)::int AS best_rank
        FROM (
          SELECT user_id, map_id, max(best_rank)::int AS worst_rank
          FROM (
            SELECT user_id, map_id, category_slug, min(board_rank)::int AS best_rank
            FROM owned
            WHERE game_slug = 'bo4'
              AND category_slug IN (
                'high-round',
                'high-round-hc',
                'realistic',
                'flawless',
                'flawless-hc'
              )
            GROUP BY user_id, map_id, category_slug
          ) progress
          GROUP BY user_id, map_id
          HAVING count(*) = 5
        ) candidates
        GROUP BY user_id
      ),
      extinction_protocols AS (
        SELECT user_id, min(worst_rank)::int AS best_rank
        FROM (
          SELECT user_id, map_id, max(best_rank)::int AS worst_rank
          FROM (
            SELECT user_id, map_id,
              CASE
                WHEN variant LIKE 'regular%' THEN 'regular'
                WHEN variant LIKE 'hardcore%' THEN 'hardcore'
              END AS family,
              min(board_rank)::int AS best_rank
            FROM owned
            WHERE game_slug = 'ghosts' AND category_slug = 'extinction-high-score'
              AND (variant LIKE 'regular%' OR variant LIKE 'hardcore%')
            GROUP BY user_id, map_id,
              CASE
                WHEN variant LIKE 'regular%' THEN 'regular'
                WHEN variant LIKE 'hardcore%' THEN 'hardcore'
              END
          ) progress
          GROUP BY user_id, map_id
          HAVING count(*) = 2
        ) candidates
        GROUP BY user_id
      ),
      category_families AS (
        SELECT user_id,
          count(distinct CASE
            WHEN category_slug IN ('high-round', 'high-round-hc', 'high-round-survival')
              THEN 'high-round'
            WHEN category_slug IN ('30-speedrun', '30-speedrun-survival', 'com-remix-30-speedrun')
              THEN '30-speedrun'
            WHEN category_slug IN ('50-speedrun', 'com-remix-50-speedrun')
              THEN '50-speedrun'
            WHEN category_slug = '100-speedrun' THEN '100-speedrun'
            WHEN category_slug = 'no-power' THEN 'no-power'
            WHEN category_slug = 'first-room' THEN 'first-room'
          END) FILTER (WHERE board_rank <= 3)::int AS top3_families
        FROM owned
        GROUP BY user_id
      ),
      game_progress AS (
        SELECT user_id, game_id,
          count(distinct submission_id)::int AS record_count,
          avg(board_rank)::double precision AS average_rank
        FROM owned
        GROUP BY user_id, game_id
      ),
      specialists AS (
        SELECT user_id,
          coalesce(max(record_count) FILTER (
            WHERE record_count >= 25 AND average_rank <= 15
          ), 0)::int AS game_specialist_records
        FROM game_progress
        GROUP BY user_id
      ),
      eligible_map_categories AS (
        SELECT map.id AS map_id, assignment.category_id
        FROM maps map
        JOIN category_assignments assignment
          ON assignment.game_id = map.game_id
          AND (assignment.map_id IS NULL OR assignment.map_id = map.id)
        GROUP BY map.id, assignment.category_id
      ),
      eligible_maps AS (
        SELECT map_id, count(*)::int AS category_count
        FROM eligible_map_categories
        GROUP BY map_id
        HAVING count(*) >= 8
      ),
      map_category_progress AS (
        SELECT owned.user_id, owned.map_id, owned.category_id, min(owned.board_rank)::int AS best_rank
        FROM owned
        JOIN eligible_maps eligible ON eligible.map_id = owned.map_id
        GROUP BY owned.user_id, owned.map_id, owned.category_id
      ),
      dominated_maps AS (
        SELECT progress.user_id, progress.map_id, max(progress.best_rank)::int AS worst_rank
        FROM map_category_progress progress
        JOIN eligible_maps eligible ON eligible.map_id = progress.map_id
        GROUP BY progress.user_id, progress.map_id, eligible.category_count
        HAVING count(distinct progress.category_id) >= eligible.category_count
      ),
      domination AS (
        SELECT user_id, min(worst_rank)::int AS map_domination_best_rank
        FROM dominated_maps
        GROUP BY user_id
      ),
      player_ids AS (
        SELECT user_id FROM base
        UNION SELECT user_id FROM category_families
        UNION SELECT user_id FROM specialists
        UNION SELECT user_id FROM domination
        UNION SELECT user_id FROM format_sweeps
        UNION SELECT user_id FROM speedrun_ladders
        UNION SELECT user_id FROM no_crutches
        UNION SELECT user_id FROM clean_extractions
        UNION SELECT user_id FROM double_agents
        UNION SELECT user_id FROM restricted_arsenals
        UNION SELECT user_id FROM hardcore_credentials
        UNION SELECT user_id FROM extinction_protocols
      )
      SELECT player.user_id,
        coalesce(base.podium_records, 0)::int AS podium_records,
        CASE WHEN coalesce(families.top3_families, 0) = 6 THEN 1 ELSE 0 END::int
          AS jack_of_all_trades_top3,
        coalesce(specialists.game_specialist_records, 0)::int AS game_specialist_records,
        domination.map_domination_best_rank,
        coalesce(base.world_record_games, 0)::int AS world_record_games,
        format_sweeps.best_rank AS format_sweep_best_rank,
        speedrun_ladders.best_rank AS speedrun_ladder_best_rank,
        no_crutches.best_rank AS no_crutches_best_rank,
        clean_extractions.best_rank AS clean_extraction_best_rank,
        double_agents.best_rank AS double_agent_best_rank,
        restricted_arsenals.best_rank AS restricted_arsenal_best_rank,
        hardcore_credentials.best_rank AS hardcore_credentials_best_rank,
        base.first_room_official_round,
        base.flawless_official_round,
        extinction_protocols.best_rank AS extinction_protocol_best_rank,
        base.endurance_best_rank,
        coalesce(base.bo3_reset_maps, 0)::int AS bo3_reset_maps
      FROM player_ids player
      LEFT JOIN base ON base.user_id = player.user_id
      LEFT JOIN category_families families ON families.user_id = player.user_id
      LEFT JOIN specialists ON specialists.user_id = player.user_id
      LEFT JOIN domination ON domination.user_id = player.user_id
      LEFT JOIN format_sweeps ON format_sweeps.user_id = player.user_id
      LEFT JOIN speedrun_ladders ON speedrun_ladders.user_id = player.user_id
      LEFT JOIN no_crutches ON no_crutches.user_id = player.user_id
      LEFT JOIN clean_extractions ON clean_extractions.user_id = player.user_id
      LEFT JOIN double_agents ON double_agents.user_id = player.user_id
      LEFT JOIN restricted_arsenals ON restricted_arsenals.user_id = player.user_id
      LEFT JOIN hardcore_credentials ON hardcore_credentials.user_id = player.user_id
      LEFT JOIN extinction_protocols ON extinction_protocols.user_id = player.user_id
    `);
    return rows.map((row) => ({
      userId: row.user_id,
      podiumRecords: Number(row.podium_records),
      jackOfAllTradesTop3: Number(row.jack_of_all_trades_top3),
      gameSpecialistRecords: Number(row.game_specialist_records),
      mapDominationBestRank: row.map_domination_best_rank === null
        ? null
        : Number(row.map_domination_best_rank),
      worldRecordGames: Number(row.world_record_games),
      formatSweepBestRank: nullableNumber(row.format_sweep_best_rank),
      speedrunLadderBestRank: nullableNumber(row.speedrun_ladder_best_rank),
      noCrutchesBestRank: nullableNumber(row.no_crutches_best_rank),
      cleanExtractionBestRank: nullableNumber(row.clean_extraction_best_rank),
      doubleAgentBestRank: nullableNumber(row.double_agent_best_rank),
      restrictedArsenalBestRank: nullableNumber(row.restricted_arsenal_best_rank),
      hardcoreCredentialsBestRank: nullableNumber(row.hardcore_credentials_best_rank),
      firstRoomOfficialRound: nullableNumber(row.first_room_official_round),
      flawlessOfficialRound: nullableNumber(row.flawless_official_round),
      extinctionProtocolBestRank: nullableNumber(row.extinction_protocol_best_rank),
      enduranceBestRank: nullableNumber(row.endurance_best_rank),
      bo3ResetMaps: Number(row.bo3_reset_maps),
    }));
  },
};

const teamwork: MetricQuery<TeamworkMetricRow> = {
  async load(db, userId) {
    const rows = await db.execute<{
      user_id: string;
      dynamic_duo_records: number;
      dynamic_duo_world_records: number;
      distinct_top3_partners: number;
      distinct_top1_partners: number;
    }>(sql`
      WITH ranked_duos AS (
        SELECT runs.id AS submission_id,
          row_number() OVER (
            PARTITION BY runs.map_id, runs.category_id, runs.category_assignment_id, runs.player_count
            ORDER BY
              CASE WHEN category.score_type = 'round' OR category.ranking_direction = 'higher_is_better'
                THEN runs.score_value END DESC NULLS LAST,
              CASE WHEN category.score_type <> 'round' AND category.ranking_direction = 'lower_is_better'
                THEN runs.score_value END ASC NULLS LAST,
              CASE WHEN category.score_type = 'round' THEN runs.run_duration_ms END ASC NULLS LAST,
              runs.verified_at ASC, runs.id ASC
          ) AS board_rank
        FROM best_records records
        JOIN submissions runs ON runs.id = records.submission_id
        JOIN categories category ON category.id = runs.category_id
        WHERE runs.status = 'verified' AND runs.player_count = 2
      ),
      pairs AS (
        SELECT own.user_id, teammate.user_id AS partner_id,
          ranked.submission_id, ranked.board_rank
        FROM ranked_duos ranked
        JOIN submission_participants own ON own.submission_id = ranked.submission_id
        JOIN submission_participants teammate
          ON teammate.submission_id = ranked.submission_id
          AND teammate.user_id <> own.user_id
        WHERE own.status = 'accepted' AND teammate.status = 'accepted'
          ${userId ? sql`AND own.user_id = ${userId}` : sql``}
      ),
      pair_progress AS (
        SELECT user_id, partner_id,
          count(distinct submission_id)::int AS record_count,
          count(distinct submission_id) FILTER (WHERE board_rank = 1)::int AS world_record_count,
          bool_or(board_rank <= 3) AS has_top3,
          bool_or(board_rank = 1) AS has_top1
        FROM pairs
        GROUP BY user_id, partner_id
      )
      SELECT user_id,
        max(record_count)::int AS dynamic_duo_records,
        max(world_record_count)::int AS dynamic_duo_world_records,
        count(*) FILTER (WHERE has_top3)::int AS distinct_top3_partners,
        count(*) FILTER (WHERE has_top1)::int AS distinct_top1_partners
      FROM pair_progress
      GROUP BY user_id
    `);
    return rows.map((row) => ({
      userId: row.user_id,
      dynamicDuoRecords: Number(row.dynamic_duo_records),
      dynamicDuoWorldRecords: Number(row.dynamic_duo_world_records),
      distinctTop3Partners: Number(row.distinct_top3_partners),
      distinctTop1Partners: Number(row.distinct_top1_partners),
    }));
  },
};

const historicalWorldRecords: MetricQuery<HistoricalWorldRecordMetricRow> = {
  async load(db, userId) {
    const rows = await db.execute<{
      user_id: string;
      back_from_the_dead: number;
      duo_self_snipe: number;
      self_wr_improvement: number;
      wr_weekend: number;
      longest_reign_days: number;
      record_breaker_days: number;
    }>(sql`
      WITH chronological AS (
        SELECT runs.id AS submission_id,
          runs.map_id,
          runs.category_assignment_id,
          runs.player_count,
          runs.competitor_key,
          runs.score_value,
          runs.run_duration_ms,
          runs.verified_at,
          category.score_type,
          category.ranking_direction
        FROM submissions runs
        JOIN categories category ON category.id = runs.category_id
        WHERE runs.status = 'verified' AND runs.verified_at IS NOT NULL
      ),
      wr_events AS (
        SELECT candidate.*
        FROM chronological candidate
        WHERE NOT EXISTS (
          SELECT 1
          FROM chronological earlier
          WHERE earlier.map_id = candidate.map_id
            AND earlier.category_assignment_id IS NOT DISTINCT FROM candidate.category_assignment_id
            AND earlier.player_count = candidate.player_count
            AND (
              earlier.verified_at < candidate.verified_at
              OR (earlier.verified_at = candidate.verified_at
                AND earlier.submission_id < candidate.submission_id)
            )
            AND (
              (
                (candidate.score_type = 'round'
                  OR candidate.ranking_direction = 'higher_is_better')
                AND earlier.score_value > candidate.score_value
              )
              OR (
                candidate.score_type <> 'round'
                AND candidate.ranking_direction = 'lower_is_better'
                AND earlier.score_value < candidate.score_value
              )
              OR (
                earlier.score_value = candidate.score_value
                AND (
                  candidate.score_type <> 'round'
                  OR (
                    earlier.run_duration_ms IS NOT NULL
                    AND (
                      candidate.run_duration_ms IS NULL
                      OR earlier.run_duration_ms < candidate.run_duration_ms
                    )
                  )
                  OR earlier.run_duration_ms IS NOT DISTINCT FROM candidate.run_duration_ms
                )
              )
            )
        )
      ),
      sequenced AS (
        SELECT event.*,
          row_number() OVER (
            PARTITION BY event.map_id, event.category_assignment_id, event.player_count
            ORDER BY event.verified_at, event.submission_id
          )::int AS event_index,
          lead(event.verified_at) OVER (
            PARTITION BY event.map_id, event.category_assignment_id, event.player_count
            ORDER BY event.verified_at, event.submission_id
          ) AS ended_at,
          lag(event.verified_at) OVER (
            PARTITION BY event.map_id, event.category_assignment_id, event.player_count
            ORDER BY event.verified_at, event.submission_id
          ) AS previous_started_at,
          lag(event.competitor_key) OVER (
            PARTITION BY event.map_id, event.category_assignment_id, event.player_count
            ORDER BY event.verified_at, event.submission_id
          ) AS previous_competitor_key,
          lag(event.submission_id) OVER (
            PARTITION BY event.map_id, event.category_assignment_id, event.player_count
            ORDER BY event.verified_at, event.submission_id
          ) AS previous_submission_id
        FROM wr_events event
      ),
      participant_events AS (
        SELECT participant.user_id, event.*
        FROM sequenced event
        JOIN submission_participants participant ON participant.submission_id = event.submission_id
        WHERE participant.status = 'accepted' ${participantFilter(userId)}
      ),
      user_sequence AS (
        SELECT participant.*,
          lag(participant.event_index) OVER (
            PARTITION BY participant.user_id, participant.map_id,
              participant.category_assignment_id, participant.player_count
            ORDER BY participant.event_index
          ) AS previous_owned_event_index,
          lead(participant.verified_at) OVER (
            PARTITION BY participant.user_id ORDER BY participant.verified_at, participant.submission_id
          ) AS next_personal_wr_at
        FROM participant_events participant
      ),
      self_snipes AS (
        SELECT current.user_id, count(*)::int AS snipe_count
        FROM participant_events current
        JOIN submission_participants previous_participant
          ON previous_participant.submission_id = current.previous_submission_id
          AND previous_participant.user_id = current.user_id
          AND previous_participant.status = 'accepted'
        WHERE current.player_count = 2
          AND current.previous_competitor_key IS DISTINCT FROM current.competitor_key
        GROUP BY current.user_id
      )
      SELECT sequence.user_id,
        max(CASE
          WHEN sequence.previous_owned_event_index IS NOT NULL
            AND sequence.event_index - sequence.previous_owned_event_index > 1
          THEN 1 ELSE 0
        END)::int AS back_from_the_dead,
        coalesce(max(self_snipes.snipe_count), 0)::int AS duo_self_snipe,
        max(CASE
          WHEN sequence.previous_competitor_key = sequence.competitor_key
          THEN 1 ELSE 0
        END)::int AS self_wr_improvement,
        max(CASE
          WHEN sequence.next_personal_wr_at <= sequence.verified_at + interval '48 hours'
          THEN 1 ELSE 0
        END)::int AS wr_weekend,
        floor(max(extract(epoch FROM (
          coalesce(sequence.ended_at, current_timestamp) - sequence.verified_at
        )) / 86400.0))::int AS longest_reign_days,
        floor(max(CASE WHEN sequence.previous_started_at IS NOT NULL
          THEN extract(epoch FROM (sequence.verified_at - sequence.previous_started_at)) / 86400.0
          ELSE 0
        END))::int AS record_breaker_days
      FROM user_sequence sequence
      LEFT JOIN self_snipes ON self_snipes.user_id = sequence.user_id
      GROUP BY sequence.user_id
    `);
    return rows.map((row) => ({
      userId: row.user_id,
      backFromTheDead: Number(row.back_from_the_dead),
      duoSelfSnipe: Number(row.duo_self_snipe),
      selfWorldRecordImprovement: Number(row.self_wr_improvement),
      wrWeekend: Number(row.wr_weekend),
      longestReignDays: Number(row.longest_reign_days),
      recordBreakerDays: Number(row.record_breaker_days),
    }));
  },
};

export const achievementQueryRegistry = {
  community,
  bo3GumTrio,
  competitive,
  teamwork,
  historicalWorldRecords,
} as const;

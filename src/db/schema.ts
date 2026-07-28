import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  externalId: text("external_id").unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  backgroundImage: text("background_image"),
  profileColor: text("profile_color").default("#101311").notNull(),
  profileGradientColor: text("profile_gradient_color"),
  profileGradientAngle: integer("profile_gradient_angle").default(135).notNull(),
  countryCode: text("country_code"),
  countryChangedAt: timestamp("country_changed_at", { withTimezone: true }),
  roles: jsonb("roles").$type<string[]>().default(["ROLE_USER"]).notNull(),
  performancePoints: doublePrecision("performance_points").default(0).notNull(),
  autoAcceptClanRuns: boolean("auto_accept_clan_runs").default(true).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("users_performance_points_idx").on(table.performancePoints)]);

export const badgeDefinitions = pgTable("badge_definitions", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").default("").notNull(),
  color: text("color").default("#e45735").notNull(),
  icon: text("icon"),
  system: boolean("system").default(false).notNull(),
  ...timestamps,
});

export const userBadges = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  badgeId: integer("badge_id").notNull().references(() => badgeDefinitions.id, { onDelete: "cascade" }),
  awardedBy: text("awarded_by").references(() => users.id, { onDelete: "set null" }),
  awardedAt: timestamp("awarded_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("user_badges_user_badge_uidx").on(table.userId, table.badgeId),
  index("user_badges_user_idx").on(table.userId),
]);

export const performancePointSnapshots = pgTable("performance_point_snapshots", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  points: doublePrecision("points").notNull(),
  delta: doublePrecision("delta").notNull(),
  source: text("source", { enum: ["baseline", "submission", "daily", "formula_change"] }).notNull(),
  sourceSubmissionId: integer("source_submission_id"),
  formulaVersion: integer("formula_version").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("performance_point_snapshots_user_time_idx").on(table.userId, table.recordedAt),
  index("performance_point_snapshots_source_submission_idx").on(table.sourceSubmissionId),
]);

export const userGamePerformance = pgTable("user_game_performance", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gameId: integer("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  performancePoints: doublePrecision("performance_points").notNull(),
  recordCount: integer("record_count").notNull(),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.gameId] }),
  index("user_game_performance_rank_idx").on(
    table.gameId,
    table.performancePoints,
    table.userId,
  ),
]);

export const userCategoryPerformance = pgTable("user_category_performance", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull().references(() => categories.id, {
    onDelete: "cascade",
  }),
  performancePoints: doublePrecision("performance_points").notNull(),
  recordCount: integer("record_count").notNull(),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.categoryId] }),
  index("user_category_performance_rank_idx").on(
    table.categoryId,
    table.performancePoints,
    table.userId,
  ),
]);

export const userGoals = pgTable("user_goals", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  metric: text("metric", {
    enum: ["performance_points", "verified_submissions", "round", "time", "rank"],
  }).notNull(),
  targetValue: doublePrecision("target_value").notNull(),
  gameId: integer("game_id").references(() => games.id, { onDelete: "cascade" }),
  mapId: integer("map_id").references(() => maps.id, { onDelete: "cascade" }),
  categoryAssignmentId: integer("category_assignment_id").references(() => categoryAssignments.id, {
    onDelete: "cascade",
  }),
  playerCount: integer("player_count"),
  status: text("status", { enum: ["active", "completed", "abandoned"] }).default("active").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("user_goals_user_status_idx").on(table.userId, table.status)]);

export const achievementDefinitions = pgTable("achievement_definitions", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  metric: text("metric", {
    enum: [
      "performance_points",
      "verified_submissions",
      "world_records",
      "games_played",
      "team_records",
      "record_points",
      "classic_high_round",
      "bo3_high_round",
      "waw_high_round",
      "speedrun_30",
      "speedrun_50",
      "speedrun_100",
      "other_speedrun_30",
      "other_speedrun_50",
      "other_speedrun_100",
      "no_power_round",
      "maps_played",
      "team_best_rank",
      "map_top15_categories",
      "map_all_categories_top15",
      "world_records_2p",
      "world_records_3p",
      "world_records_4p",
      "team_formats_played",
      "categories_played",
      "game_high_round_top15_complete",
      "game_ee_top20_records",
      "game_all_ee_top20",
      "community_records",
      "community_best_rank",
      "bo3_gum_trio_best_rank",
      "back_from_the_dead",
      "podium_records",
      "jack_of_all_trades_top3",
      "game_specialist_records",
      "map_domination_best_rank",
      "dynamic_duo_records",
      "dynamic_duo_world_records",
      "distinct_top3_duo_partners",
      "distinct_top1_duo_partners",
      "duo_self_snipe",
      "self_wr_improvement",
      "wr_weekend",
      "wr_games",
      "longest_wr_reign_days",
      "record_breaker_days",
      "format_sweep_best_rank",
      "speedrun_ladder_best_rank",
      "no_crutches_best_rank",
      "clean_extraction_best_rank",
      "double_agent_best_rank",
      "restricted_arsenal_best_rank",
      "hardcore_credentials_best_rank",
      "first_room_official_round",
      "flawless_official_round",
      "extinction_protocol_best_rank",
      "endurance_best_rank",
      "bo3_reset_maps",
    ],
  }).notNull(),
  threshold: doublePrecision("threshold").notNull(),
  direction: text("direction", { enum: ["higher_is_better", "lower_is_better"] }).default("higher_is_better")
    .notNull(),
  category: text("category").default("Milestones").notNull(),
  series: text("series").default("general").notNull(),
  tier: integer("tier").default(1).notNull(),
  points: integer("points").default(10).notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
});

export const userAchievements = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  achievementId: integer("achievement_id").notNull().references(() => achievementDefinitions.id, {
    onDelete: "cascade",
  }),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("user_achievements_unique").on(table.userId, table.achievementId)]);

export const achievementMetricSnapshots = pgTable("achievement_metric_snapshots", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  values: jsonb("values").$type<Record<string, number | null>>().notNull(),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  metric: text("metric", { enum: ["performance_points", "verified_submissions"] }).notNull(),
  targetValue: doublePrecision("target_value").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => [index("challenges_window_idx").on(table.active, table.startsAt, table.endsAt)]);

export const clans = pgTable("clans", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  logoImage: text("logo_image"),
  backgroundImage: text("background_image"),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  ...timestamps,
});

export const clanMembers = pgTable(
  "clan_members",
  {
    id: serial("id").primaryKey(),
    clanId: integer("clan_id").notNull().references(() => clans.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "member"] }).default("member").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("clan_members_clan_user_unique").on(table.clanId, table.userId),
    uniqueIndex("clan_members_user_unique").on(table.userId),
    uniqueIndex("clan_members_one_owner_unique").on(table.clanId).where(sql`${table.role} = 'owner'`),
  ],
);

export const clanInvitations = pgTable(
  "clan_invitations",
  {
    id: serial("id").primaryKey(),
    clanId: integer("clan_id").notNull().references(() => clans.id, { onDelete: "cascade" }),
    inviteeUserId: text("invitee_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    status: text("status", { enum: ["pending", "accepted", "rejected", "revoked", "expired"] })
      .default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("clan_invitations_invitee_status_idx").on(table.inviteeUserId, table.status),
    uniqueIndex("clan_invitations_pending_unique").on(table.clanId, table.inviteeUserId)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export const clanAuditEvents = pgTable(
  "clan_audit_events",
  {
    id: serial("id").primaryKey(),
    clanId: integer("clan_id").notNull().references(() => clans.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    targetUserId: text("target_user_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type", {
      enum: [
        "clan_created",
        "member_invited",
        "invitation_accepted",
        "invitation_rejected",
        "invitation_revoked",
        "member_role_changed",
        "ownership_transferred",
        "member_left",
        "member_removed",
      ],
    }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("clan_audit_events_clan_created_idx").on(table.clanId, table.createdAt)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ...timestamps,
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  releaseYear: integer("release_year"),
  gameType: text("game_type", { enum: ["zombies", "non_zombies"] }).default("zombies").notNull(),
  studio: text("studio").default("Unknown").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const maps = pgTable(
  "maps",
  {
    id: serial("id").primaryKey(),
    gameId: integer("game_id").notNull().references(() => games.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    type: text("type", { enum: ["official", "custom", "uem"] }).notNull(),
    status: text("status", { enum: ["draft", "published", "archived"] }).default("draft").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    description: text("description"),
    authors: jsonb("authors").$type<string[]>().default([]).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("maps_game_slug_unique").on(table.gameId, table.slug),
    index("maps_game_name_idx").on(table.gameId, table.name),
    index("maps_type_id_idx").on(table.type, table.id),
  ],
);

export const mapSources = pgTable(
  "map_sources",
  {
    id: serial("id").primaryKey(),
    mapId: integer("map_id").notNull().references(() => maps.id, { onDelete: "cascade" }),
    source: text("source", { enum: ["steam", "ugx", "manual", "other"] }).notNull(),
    sourceUrl: text("source_url").notNull(),
    externalId: text("external_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  },
  (table) => [index("map_sources_map_id_idx").on(table.mapId)],
);

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    scoreType: text("score_type", { enum: ["round", "time", "kills", "points", "custom"] }).notNull(),
    rankingDirection: text("ranking_direction", { enum: ["higher_is_better", "lower_is_better"] }).notNull(),
    rules: jsonb("rules").$type<Record<string, unknown>>().default({}).notNull(),
  },
  (table) => [uniqueIndex("categories_slug_unique").on(table.slug)],
);

export const categoryAssignments = pgTable(
  "category_assignments",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
    gameId: integer("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    mapId: integer("map_id").references(() => maps.id, { onDelete: "cascade" }),
    specificRules: jsonb("specific_rules").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("category_assignments_game_map_idx").on(table.gameId, table.mapId),
    index("category_assignments_category_idx").on(table.categoryId),
    index("category_assignments_gum_rules_idx").on(sql`(${table.specificRules}->>'zwrSubrecord')`),
  ],
);

export const mods = pgTable(
  "mods",
  {
    id: serial("id").primaryKey(),
    gameId: integer("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
  },
  (table) => [uniqueIndex("mods_game_slug_unique").on(table.gameId, table.slug)],
);

export const submissions = pgTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    externalId: text("external_id").unique(),
    submissionGroupId: text("submission_group_id"),
    userId: text("user_id").notNull(),
    competitorKey: text("competitor_key").notNull(),
    gameId: integer("game_id").notNull().references(() => games.id, { onDelete: "restrict" }),
    mapId: integer("map_id").notNull().references(() => maps.id, { onDelete: "restrict" }),
    categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "restrict" }),
    categoryAssignmentId: integer("category_assignment_id").references(() => categoryAssignments.id, {
      onDelete: "restrict",
    }),
    playerCount: integer("player_count").default(1).notNull(),
    scoreValue: bigint("score_value", { mode: "number" }).notNull(),
    runDurationMs: bigint("run_duration_ms", { mode: "number" }),
    platform: text("platform"),
    gameVersion: text("game_version"),
    mapVersion: text("map_version"),
    modId: integer("mod_id").references(() => mods.id, { onDelete: "restrict" }),
    modVersion: text("mod_version"),
    status: text("status", {
      enum: ["awaiting_participants", "pending", "verified", "rejected", "cancelled"],
    }).default("pending").notNull(),
    proofLevel: text("proof_level", {
      enum: ["manual_video", "client_recorded", "client_recorded_with_inputs", "verified_client_package"],
    }).notNull(),
    proofUrl: text("proof_url"),
    submittedBy: text("submitted_by"),
    verifiedBy: text("verified_by"),
    reviewNote: text("review_note"),
    rulesSnapshot: jsonb("rules_snapshot").$type<Record<string, unknown>>().default({}).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (table) => [
    index("submissions_category_status_idx").on(table.categoryId, table.status),
    index("submissions_verified_map_assignment_leaderboard_idx")
      .on(table.mapId, table.categoryAssignmentId, table.scoreValue, table.id)
      .where(sql`${table.status} = 'verified'`),
    index("submissions_user_idx").on(table.userId),
    index("submissions_group_idx").on(table.submissionGroupId),
    index("submissions_active_submitter_idx").on(table.submittedBy)
      .where(sql`${table.externalId} IS NULL AND ${table.status} IN ('awaiting_participants', 'pending')`),
    index("submissions_competitor_best_idx")
      .on(table.mapId, table.categoryAssignmentId, table.competitorKey)
      .where(sql`${table.status} = 'verified'`),
    index("submissions_roster_lookup_idx")
      .on(table.competitorKey, table.playerCount, table.mapId, table.categoryAssignmentId)
      .where(sql`${table.status} = 'verified'`),
    index("submissions_map_assignment_player_count_idx").on(
      table.mapId,
      table.categoryAssignmentId,
      table.playerCount,
    ),
  ],
);

/** The single best verified run for a player in a map/category assignment. */
export const bestRecords = pgTable(
  "best_records",
  {
    submissionId: integer("submission_id").primaryKey().references(() => submissions.id, {
      onDelete: "restrict",
    }),
    points: doublePrecision("points").default(0).notNull(),
  },
  (table) => [index("best_records_points_idx").on(table.points, table.submissionId)],
);

export const submissionParticipants = pgTable(
  "submission_participants",
  {
    submissionId: integer("submission_id").notNull().references(() => submissions.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    role: text("role", { enum: ["primary", "teammate"] }).default("teammate").notNull(),
    status: text("status", { enum: ["pending", "accepted", "rejected"] }).default("accepted").notNull(),
    acceptanceSource: text("acceptance_source", {
      enum: ["submitter", "clan", "invitation", "imported", "legacy"],
    }).default("legacy").notNull(),
    acceptanceClanId: integer("acceptance_clan_id"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    isPersonalBest: boolean("is_personal_best").default(false).notNull(),
  },
  (table) => [
    uniqueIndex("submission_participants_unique").on(table.submissionId, table.userId),
    index("submission_participants_user_idx").on(table.userId),
    index("submission_participants_accepted_user_submission_idx")
      .on(table.userId, table.submissionId)
      .where(sql`${table.status} = 'accepted'`),
    index("submission_participants_personal_best_idx").on(table.userId, table.isPersonalBest),
    index("submission_participants_personal_best_user_submission_idx")
      .on(table.userId, table.submissionId)
      .where(sql`${table.isPersonalBest} = true`),
  ],
);

export const participationInvitations = pgTable(
  "participation_invitations",
  {
    id: serial("id").primaryKey(),
    submissionGroupId: text("submission_group_id").notNull(),
    inviteeUserId: text("invitee_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    status: text("status", { enum: ["pending", "accepted", "rejected", "revoked", "expired"] })
      .default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("participation_invitations_group_user_unique").on(
      table.submissionGroupId,
      table.inviteeUserId,
    ),
    index("participation_invitations_invitee_status_idx").on(table.inviteeUserId, table.status),
  ],
);

export const submissionProofs = pgTable(
  "submission_proofs",
  {
    id: serial("id").primaryKey(),
    submissionId: integer("submission_id").notNull().references(() => submissions.id, {
      onDelete: "cascade",
    }),
    type: text("type", { enum: ["demo", "input_log", "event_log", "screenshot", "video", "hash_manifest"] })
      .notNull(),
    sourceUrl: text("source_url"),
    storageKey: text("storage_key"),
    sha256: text("sha256"),
    mimeType: text("mime_type"),
    formatVersion: integer("format_version").default(1).notNull(),
    provider: text("provider", { enum: ["youtube", "twitch", "steam", "direct", "other"] }).default("other")
      .notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  },
  (table) => [index("submission_proofs_submission_idx").on(table.submissionId)],
);

export const submissionComments = pgTable(
  "submission_comments",
  {
    id: serial("id").primaryKey(),
    submissionId: integer("submission_id").notNull().references(() => submissions.id, {
      onDelete: "cascade",
    }),
    parentId: integer("parent_id").references((): AnyPgColumn => submissionComments.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    ...timestamps,
  },
  (table) => [
    index("submission_comments_submission_created_idx").on(table.submissionId, table.createdAt),
    index("submission_comments_user_idx").on(table.userId),
  ],
);

export const submissionCommentVotes = pgTable(
  "submission_comment_votes",
  {
    commentId: integer("comment_id").notNull().references(() => submissionComments.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    value: integer("value").notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.commentId, table.userId] }),
    index("submission_comment_votes_user_idx").on(table.userId),
  ],
);

export const profilePinnedRecords = pgTable(
  "profile_pinned_records",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    submissionId: integer("submission_id").notNull().references(() => submissions.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.submissionId] }),
    index("profile_pinned_records_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const profileClaims = pgTable(
  "profile_claims",
  {
    id: serial("id").primaryKey(),
    claimantUserId: text("claimant_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    profileUserId: text("profile_user_id").references(() => users.id, { onDelete: "set null" }),
    profileExternalId: text("profile_external_id").notNull(),
    proofUrl: text("proof_url").notNull(),
    message: text("message"),
    status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
    reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    index("profile_claims_claimant_idx").on(table.claimantUserId, table.createdAt),
    index("profile_claims_status_idx").on(table.status, table.createdAt),
    uniqueIndex("profile_claims_active_profile_unique").on(table.profileExternalId)
      .where(sql`${table.status} IN ('pending', 'approved')`),
    uniqueIndex("profile_claims_active_claimant_unique").on(table.claimantUserId)
      .where(sql`${table.status} IN ('pending', 'approved')`),
  ],
);

export const follows = pgTable(
  "follows",
  {
    id: serial("id").primaryKey(),
    followerUserId: text("follower_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type", {
      enum: ["user", "game", "map", "category_assignment", "map_category", "team"],
    }).notNull(),
    targetId: text("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("follows_target_unique").on(table.followerUserId, table.targetType, table.targetId),
    index("follows_target_idx").on(table.targetType, table.targetId),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: serial("id").primaryKey(),
    eventKey: text("event_key").notNull().unique(),
    type: text("type").notNull(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    recipientUserIds: jsonb("recipient_user_ids").$type<string[]>().default([]).notNull(),
    subjects: jsonb("subjects").$type<Array<{ type: string; id: string }>>().default([]).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [index("outbox_events_pending_idx").on(table.id).where(sql`${table.processedAt} IS NULL`)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    recipientUserId: text("recipient_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    outboxEventId: integer("outbox_event_id").notNull().references(() => outboxEvents.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("notifications_event_recipient_unique").on(table.outboxEventId, table.recipientUserId),
    index("notifications_recipient_cursor_idx").on(table.recipientUserId, table.id),
  ],
);

export const feedEntries = pgTable(
  "feed_entries",
  {
    id: serial("id").primaryKey(),
    viewerUserId: text("viewer_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    outboxEventId: integer("outbox_event_id").notNull().references(() => outboxEvents.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("feed_entries_event_viewer_unique").on(table.outboxEventId, table.viewerUserId),
    index("feed_entries_viewer_cursor_idx").on(table.viewerUserId, table.id),
  ],
);

export const personalRuns = pgTable(
  "personal_runs",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    gameId: integer("game_id").notNull().references(() => games.id, { onDelete: "restrict" }),
    mapId: integer("map_id").notNull().references(() => maps.id, { onDelete: "restrict" }),
    categoryAssignmentId: integer("category_assignment_id").notNull().references(
      () => categoryAssignments.id,
      { onDelete: "restrict" },
    ),
    playerCount: integer("player_count").default(1).notNull(),
    scoreValue: bigint("score_value", { mode: "number" }).notNull(),
    runDurationMs: bigint("run_duration_ms", { mode: "number" }),
    proofLevel: text("proof_level", {
      enum: ["manual_video", "client_recorded", "client_recorded_with_inputs", "verified_client_package"],
    }),
    proofUrl: text("proof_url"),
    visibility: text("visibility", { enum: ["private", "followers", "public"] }).default("private")
      .notNull(),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    promotedSubmissionId: integer("promoted_submission_id").unique().references(() => submissions.id, {
      onDelete: "set null",
    }),
    promotedAt: timestamp("promoted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("personal_runs_user_cursor_idx").on(table.userId, table.id),
    index("personal_runs_user_board_idx").on(
      table.userId,
      table.mapId,
      table.categoryAssignmentId,
      table.playerCount,
    ),
  ],
);

export const clientVersions = pgTable(
  "client_versions",
  {
    id: serial("id").primaryKey(),
    clientName: text("client_name").notNull(),
    version: text("version").notNull(),
    protocolVersion: integer("protocol_version").notNull(),
    status: text("status", { enum: ["allowed", "revoked"] }).default("allowed").notNull(),
    releaseNotes: text("release_notes"),
    ...timestamps,
  },
  (table) => [uniqueIndex("client_versions_identity_unique").on(table.clientName, table.version)],
);

export const clientInstallations = pgTable(
  "client_installations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    publicKeySpki: text("public_key_spki").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("client_installations_user_idx").on(table.userId, table.createdAt)],
);

export const clientRuns = pgTable(
  "client_runs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    installationId: text("installation_id").notNull().references(() => clientInstallations.id, {
      onDelete: "cascade",
    }),
    clientVersionId: integer("client_version_id").notNull().references(() => clientVersions.id, {
      onDelete: "restrict",
    }),
    gameId: integer("game_id").notNull().references(() => games.id, { onDelete: "restrict" }),
    mapId: integer("map_id").notNull().references(() => maps.id, { onDelete: "restrict" }),
    platform: text("platform"),
    gameVersion: text("game_version"),
    mapVersion: text("map_version"),
    modId: integer("mod_id").references(() => mods.id, { onDelete: "restrict" }),
    modVersion: text("mod_version"),
    participantUserIds: jsonb("participant_user_ids").$type<string[]>().default([]).notNull(),
    runTokenHash: text("run_token_hash").notNull(),
    startPayloadSha256: text("start_payload_sha256").notNull(),
    status: text("status", { enum: ["active", "finalizing", "finalized", "abandoned"] }).default("active")
      .notNull(),
    latestHeartbeatSequence: integer("latest_heartbeat_sequence").default(0).notNull(),
    latestGameElapsedMs: bigint("latest_game_elapsed_ms", { mode: "number" }).default(0).notNull(),
    latestRound: integer("latest_round"),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    heartbeatGapCount: integer("heartbeat_gap_count").default(0).notNull(),
    maxHeartbeatGapMs: bigint("max_heartbeat_gap_ms", { mode: "number" }).default(0).notNull(),
    latestChunkSequence: integer("latest_chunk_sequence").default(0).notNull(),
    latestChunkEndElapsedMs: bigint("latest_chunk_end_elapsed_ms", { mode: "number" }).default(0).notNull(),
    chunkChainHeadSha256: text("chunk_chain_head_sha256"),
    finalizationSha256: text("finalization_sha256"),
    finalizationPayload: jsonb("finalization_payload").$type<Record<string, unknown>>(),
    finalizationIssues: jsonb("finalization_issues").$type<string[]>().default([]).notNull(),
    submissionGroupId: text("submission_group_id"),
    blobState: text("blob_state", { enum: ["active", "retained", "deleted"] }).default("active").notNull(),
    blobsDeletedAt: timestamp("blobs_deleted_at", { withTimezone: true }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    abandonedAt: timestamp("abandoned_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("client_runs_user_created_idx").on(table.userId, table.createdAt),
    index("client_runs_installation_status_idx").on(table.installationId, table.status),
    index("client_runs_blob_cleanup_idx").on(table.blobState, table.status, table.finalizedAt)
      .where(sql`${table.blobState} = 'retained'`),
  ],
);

export const clientRunChunks = pgTable(
  "client_run_chunks",
  {
    id: serial("id").primaryKey(),
    runId: text("run_id").notNull().references(() => clientRuns.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    startElapsedMs: bigint("start_elapsed_ms", { mode: "number" }).notNull(),
    endElapsedMs: bigint("end_elapsed_ms", { mode: "number" }).notNull(),
    previousChunkSha256: text("previous_chunk_sha256"),
    compressedSha256: text("compressed_sha256").notNull(),
    uncompressedSha256: text("uncompressed_sha256").notNull(),
    compression: text("compression", { enum: ["gzip"] }).notNull(),
    payloadFormat: text("payload_format").notNull(),
    storageKey: text("storage_key").notNull(),
    uncompressedBytes: integer("uncompressed_bytes").notNull(),
    eventCount: integer("event_count").notNull(),
    signature: text("signature").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("client_run_chunks_sequence_unique").on(table.runId, table.sequence),
    uniqueIndex("client_run_chunks_hash_unique").on(table.runId, table.compressedSha256),
  ],
);

export const gamesRelations = relations(
  games,
  ({ many }) => ({ maps: many(maps), categoryAssignments: many(categoryAssignments) }),
);
export const mapsRelations = relations(maps, ({ one, many }) => ({
  game: one(games, { fields: [maps.gameId], references: [games.id] }),
  sources: many(mapSources),
  categoryAssignments: many(categoryAssignments),
}));
export const mapSourcesRelations = relations(mapSources, ({ one }) => ({
  map: one(maps, { fields: [mapSources.mapId], references: [maps.id] }),
}));
export const categoriesRelations = relations(categories, ({ many }) => ({
  assignments: many(categoryAssignments),
  submissions: many(submissions),
}));
export const categoryAssignmentsRelations = relations(categoryAssignments, ({ one, many }) => ({
  category: one(categories, { fields: [categoryAssignments.categoryId], references: [categories.id] }),
  game: one(games, { fields: [categoryAssignments.gameId], references: [games.id] }),
  map: one(maps, { fields: [categoryAssignments.mapId], references: [maps.id] }),
  submissions: many(submissions),
}));
export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  game: one(games, { fields: [submissions.gameId], references: [games.id] }),
  map: one(maps, { fields: [submissions.mapId], references: [maps.id] }),
  category: one(categories, { fields: [submissions.categoryId], references: [categories.id] }),
  categoryAssignment: one(categoryAssignments, {
    fields: [submissions.categoryAssignmentId],
    references: [categoryAssignments.id],
  }),
  mod: one(mods, { fields: [submissions.modId], references: [mods.id] }),
  participants: many(submissionParticipants),
  proofs: many(submissionProofs),
}));
export const bestRecordsRelations = relations(bestRecords, ({ one }) => ({
  submission: one(submissions, { fields: [bestRecords.submissionId], references: [submissions.id] }),
}));
export const submissionParticipantsRelations = relations(submissionParticipants, ({ one }) => ({
  submission: one(submissions, {
    fields: [submissionParticipants.submissionId],
    references: [submissions.id],
  }),
  user: one(users, { fields: [submissionParticipants.userId], references: [users.id] }),
}));
export const submissionProofsRelations = relations(submissionProofs, ({ one }) => ({
  submission: one(submissions, { fields: [submissionProofs.submissionId], references: [submissions.id] }),
}));
export const profileClaimsRelations = relations(profileClaims, ({ one }) => ({
  claimant: one(users, { fields: [profileClaims.claimantUserId], references: [users.id] }),
  profile: one(users, { fields: [profileClaims.profileUserId], references: [users.id] }),
  reviewer: one(users, { fields: [profileClaims.reviewedBy], references: [users.id] }),
}));

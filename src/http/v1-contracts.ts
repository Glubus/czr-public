/**
 * Test-oriented route contracts. VC is the accepted input/state domain; IC lists
 * the rejected domain and the expected problem code/status.
 */
export type RouteContract = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  /** Valid Cases: accepted request and state domain. */
  VC: readonly string[];
  /** Invalid Cases: rejected request/state domain and expected failure. */
  IC: readonly string[];
};

const route = (
  method: RouteContract["method"],
  path: string,
  vc: readonly string[],
  ic: readonly string[],
): RouteContract => ({ method, path, VC: vc, IC: ic });

export const v1RouteContracts = [
  route("GET", "/stats", ["public aggregate counts from the current database"], []),
  route("GET", "/categories", ["all public record categories sorted by name"], []),
  route("GET", "/records/highest-pp", [
    "top 50 best records ordered by awarded PP; optional category, game and map type filters",
  ], ["invalid category, game or maps_status filter: 400"]),
  route(
    "GET",
    "/records/latest-world-records",
    ["latest 50 active world records ordered by verification"],
    [],
  ),
  route(
    "GET",
    "/records/highest-pp-week",
    ["top 50 active records verified since the latest Tuesday UTC"],
    [],
  ),
  route("GET", "/media/:path", ["existing hosted JPEG, PNG, WebP or GIF"], [
    "unknown or invalid media path: 404",
  ]),
  route("GET", "/leaderboard/highest-average", [
    "top 50 players with at least five active bests by average record PP; optional category, game and map type filters",
  ], ["invalid category, game or maps_status filter: 400"]),
  route("POST", "/auth/sign-up", ["email, password and name accepted by Better Auth"], [
    "invalid body: 400 validation_failed",
  ]),
  route("POST", "/auth/sign-in", ["registered email/password"], [
    "invalid credentials: Better Auth rejection",
  ]),
  route("POST", "/auth/sign-out", ["active or absent session token"], [
    "malformed JSON: 400 validation_failed",
  ]),
  route("GET", "/auth/session", ["authenticated session returns current session"], [
    "missing session returns empty session",
  ]),
  route("POST", "/auth/request-password-reset", ["email and trusted front-end redirect URL"], [
    "invalid email/redirect: Better Auth rejection",
  ]),
  route("POST", "/auth/reset-password", ["valid unused token and new password"], [
    "expired/reused token or invalid password: Better Auth rejection",
  ]),
  route("POST", "/auth/change-password", ["authenticated user; current and valid new passwords"], [
    "anonymous or invalid current password: Better Auth rejection",
  ]),
  route("GET", "/openapi.json", ["always returns v1 OpenAPI document"], []),
  route("GET", "/games", ["optional name/slug search and non-negative page"], ["invalid page: 400"]),
  route("GET", "/games/:slug", ["existing game slug"], ["unknown slug: 404 not_found"]),
  route("POST", "/admin/games", ["game:create grant; valid slug/name/shortName"], [
    "anonymous: 401; no grant: 403; duplicate slug: 409; invalid payload: 400",
  ]),
  route("PATCH", "/admin/games/:id", ["game:create grant; positive id; one valid mutable field"], [
    "missing game: 404; empty/invalid update: 400",
  ]),
  route("GET", "/maps", ["optional catalogue search, partial name, exact game slug and non-negative page"], [
    "invalid page: 400",
  ]),
  route("POST", "/admin/maps", ["map:create grant; map references existing game"], [
    "unknown game: 404; duplicate game/slug: 409; invalid payload: 400",
  ]),
  route("PATCH", "/admin/maps/:id", ["map:create grant; existing map; non-empty update"], [
    "unknown map: 404; invalid update: 400",
  ]),
  route("PATCH", "/admin/maps/:id/status", ["map:create grant; draft, published or archived"], [
    "unknown map: 404; invalid status: 400",
  ]),
  route("GET", "/maps/:id", ["existing positive map id"], ["unknown map: 404"]),
  route("POST", "/maps/preview", ["map:preview grant; non-empty Steam, UGX or other URL"], [
    "anonymous: 401; no grant: 403; invalid body/URL: 400",
  ]),
  route("GET", "/games/:slug/mods", ["existing game slug"], ["unknown game: 404"]),
  route("POST", "/admin/mods", ["mod:create grant; existing game; unique game/slug"], [
    "unknown game: 404; duplicate: 409; invalid payload: 400",
  ]),
  route("PATCH", "/admin/mods/:id", ["mod:create grant; existing mod; name supplied"], [
    "unknown mod: 404; empty update: 400",
  ]),
  route("DELETE", "/admin/mods/:id", ["mod:create grant; mod not referenced by submissions"], [
    "unknown mod: 404; referenced mod: 409",
  ]),
  route("POST", "/admin/categories", ["category:create grant; unique slug; valid score type/direction"], [
    "duplicate slug: 409; invalid payload: 400",
  ]),
  route("GET", "/admin/categories", ["category:create grant"], ["anonymous: 401; no grant: 403"]),
  route("PATCH", "/admin/categories/:id", ["category:create grant; existing category; non-empty update"], [
    "unknown category: 404; empty/invalid update: 400",
  ]),
  route(
    "DELETE",
    "/admin/categories/:id",
    ["category:create grant; category has no submissions/assignments"],
    ["unknown category: 404; referenced category: 409"],
  ),
  route("POST", "/admin/category-assignments", [
    "category:assign grant; existing category/game and compatible optional map",
  ], ["unknown reference: 404; mismatched map/duplicate: 400 or 409"]),
  route("GET", "/admin/category-assignments", [
    "category:assign grant; optional non-negative page and positive gameId/mapId filters",
  ], ["anonymous: 401; no grant: 403; invalid filter: 400"]),
  route("PATCH", "/admin/category-assignments/:id", [
    "category:assign grant; existing assignment; rules object",
  ], ["unknown assignment: 404; invalid rules: 400"]),
  route("DELETE", "/admin/category-assignments/:id", [
    "category:assign grant; assignment unused by submissions",
  ], ["unknown assignment: 404; referenced assignment: 409"]),
  route("GET", "/maps/:id/categories", ["existing map id"], ["unknown map: 404"]),
  route("GET", "/submissions/:id", ["existing verified submission id"], [
    "unknown or unverified submission: 404; malformed id: 400",
  ]),
  route("GET", "/submissions/:id/comments", ["existing verified submission id; threaded public comments"], [
    "unknown or unverified submission: 404; malformed id: 400",
  ]),
  route("POST", "/submissions/:id/comments", [
    "authenticated user; existing verified submission; non-empty body; optional existing parent comment",
  ], ["anonymous: 401; invalid body or parent: 400/404"]),
  route("DELETE", "/submissions/:id/comments/:commentId", [
    "authenticated comment author; replies are preserved when a root comment is deleted",
  ], ["anonymous: 401; non-author: 403; unknown comment: 404"]),
  route("PUT", "/submissions/:id/comments/:commentId/vote", [
    "authenticated user; existing comment; vote is -1, 0 or 1",
  ], ["anonymous: 401; invalid vote: 400; unknown comment: 404"]),
  route("POST", "/submissions", [
    "submission:create grant; fewer than 5 active manual submissions; coherent targets, participants and score; teammate consent derived from clan or invitations",
  ], ["anonymous: 401; no grant: 403; invalid references or values: 400/404; active limit: 409"]),
  route("POST", "/submission-groups", [
    "submission:create grant; 1-5 unique compatible assignments; per-entry scores; active total remains at most 5",
  ], [
    "anonymous/no grant: 401/403; empty, oversized or duplicate entries: 400; invalid target: 400/404; active limit: 409",
  ]),
  route("PATCH", "/admin/submissions/:id/status", [
    "submission:review grant; pending submission; verified or rejected status",
  ], [
    "unknown submission: 404; awaiting participants/already reviewed/cancelled: 409; invalid payload: 400",
  ]),
  route("GET", "/admin/submissions", [
    "submission:review grant; valid optional status, ids, groupId and page",
  ], [
    "invalid filters: 400; missing grant: 401/403",
  ]),
  route("GET", "/admin/submissions/:id", ["submission:review grant; existing id"], [
    "unknown submission: 404; missing grant: 401/403",
  ]),
  route("GET", "/me/submissions", ["submission:create grant; valid optional filters including groupId"], [
    "invalid filters: 400; missing grant: 401/403",
  ]),
  route("GET", "/me/participation-invitations", [
    "authenticated teammate receives pending invitations and grouped submission context",
  ], ["missing grant: 401/403"]),
  route("PATCH", "/me/participation-invitations/:id", [
    "invited teammate accepts/rejects; final acceptance releases group to moderation",
  ], [
    "hidden invitation: 404; expired/already answered: 409; invalid decision: 400; missing grant: 401/403",
  ]),
  route("POST", "/profile-claims", ["authenticated user; unclaimed imported profile; HTTP(S) proof URL"], [
    "anonymous: 401; invalid URL: 400; profile missing: 404; active/owned profile: 409",
  ]),
  route("GET", "/me/profile-claims", ["authenticated user receives their claim history"], [
    "anonymous: 401",
  ]),
  route("PATCH", "/me/profile", ["authenticated user; valid non-empty profile metadata update"], [
    "anonymous: 401; empty or invalid update: 400",
  ]),
  route("PUT", "/me/pinned-records/:submissionId", [
    "authenticated owner pins one current verified personal best; at most three active pins",
  ], ["anonymous: 401; invalid or ineligible record: 400/404; three-pin limit: 409"]),
  route("DELETE", "/me/pinned-records/:submissionId", [
    "authenticated owner removes one pinned record",
  ], ["anonymous: 401; invalid or unknown pin: 400/404"]),
  route("POST", "/me/media/:kind", [
    "authenticated user; valid avatar, profile background, clan logo or clan background image within its size limit",
  ], ["anonymous: 401; invalid kind, type, bytes or size: 400; clan role missing: 400/404"]),
  route("DELETE", "/me/account", ["authenticated non-admin user; exact DELETE confirmation and password"], [
    "anonymous: 401; invalid confirmation or password: 400; admin role: 409",
  ]),
  route("GET", "/admin/profile-claims", ["profile-claim:review grant; optional valid status"], [
    "anonymous/no grant: 401/403; invalid status: 400",
  ]),
  route("PATCH", "/admin/profile-claims/:id/status", [
    "profile-claim:review grant; pending claim; approved or rejected decision",
  ], ["missing claim: 404; already reviewed/claimed profile: 409; invalid decision: 400"]),
  route("GET", "/maps/:mapId/categories/:categoryId/leaderboard", [
    "existing compatible map/category assignment; optional assignment, player count and non-negative page",
  ], ["invalid page: 400; unknown/incompatible targets: 404"]),
  route("GET", "/leaderboard", [
    "valid category slugs, game slug, maps_status, page and world/following/friends scope",
  ], [
    "invalid filter syntax/scope: 400; anonymous personalized scope: 401",
  ]),
  route("GET", "/clans/leaderboard", [
    "current clan memberships; top 20 distinct verified runs per clan; optional standard filters",
  ], [
    "invalid category, game, maps_status, player_count or page filter: 400",
  ]),
  route("GET", "/teams/leaderboard", [
    "required player_count 2, 3 or 4; optional category slugs, game slug, maps_status and non-negative page",
  ], [
    "missing/invalid player_count or invalid filter syntax/value: 400",
  ]),
  route("GET", "/teams/:competitorKey", [
    "exact 2P, 3P or 4P roster with at least one verified best record",
  ], [
    "malformed legacy competitor key: 400; unknown or unverified roster: 404",
  ]),
  route("GET", "/teams/:competitorKey/records", [
    "paginated verified best records belonging to the exact 2P, 3P or 4P roster",
  ], [
    "invalid page or malformed legacy competitor key: 400; unknown or unverified roster: 404",
  ]),
  route("GET", "/users", ["optional search and non-negative page"], ["invalid page: 400"]),
  route("GET", "/users/:id/records", ["existing user id; non-negative page"], [
    "invalid page: 400; unknown user: 404",
  ]),
  route("GET", "/users/:id/badges", ["badges awarded to an existing user"], [
    "unknown user: 404",
  ]),
  route("GET", "/users/:id/history", ["existing user; non-negative page"], [
    "unknown user: 404; invalid page: 400",
  ]),
  route("GET", "/users/:id/performance-history", ["existing user receives exact persisted PP snapshots"], [
    "unknown user: 404",
  ]),
  route("GET", "/users/:id/ranks", [
    "existing user receives exact nonlinear PP rank within every game and category they actively rank in",
  ], ["unknown user: 404"]),
  route("GET", "/users/:id/social-context", [
    "existing user receives current clan membership and five most-used exact team rosters",
  ], ["unknown user: 404"]),
  route("GET", "/users/:id/compare/:otherId", [
    "two distinct public users; global ranks, common boards, head-to-head, recent runs and derived friendship",
  ], ["same user: 400; unknown/deleted user: 404"]),
  route("POST", "/me/follows", [
    "authenticated user follows an existing user, game, map, category assignment, exact map/category pair or team",
  ], [
    "anonymous: 401; self/invalid target: 400; missing target: 404; duplicate follow: 409",
  ]),
  route("DELETE", "/me/follows/:targetType/:targetId", ["authenticated owner removes an existing follow"], [
    "anonymous: 401; invalid target type: 400; hidden/missing follow: 404",
  ]),
  route("GET", "/me/follows", ["authenticated owner; optional valid target type"], [
    "anonymous: 401; invalid target type: 400",
  ]),
  route("GET", "/me/feed", ["authenticated owner; descending cursor and optional event type"], [
    "anonymous: 401; invalid cursor/type: 400",
  ]),
  route("GET", "/me/notifications", [
    "authenticated owner; descending cursor, unread and event type filters",
  ], ["anonymous: 401; invalid cursor/unread/type: 400"]),
  route("GET", "/me/notifications/unread-count", ["authenticated owner"], ["anonymous: 401"]),
  route("PATCH", "/me/notifications/:id/read", ["authenticated recipient reads their notification"], [
    "anonymous: 401; invalid id: 400; another recipient or missing notification: 404",
  ]),
  route("POST", "/me/notifications/read-all", ["authenticated recipient marks every unread item read"], [
    "anonymous: 401",
  ]),
  route("POST", "/me/personal-runs", [
    "authenticated owner; coherent solo target and score; optional proof, notes and visibility",
  ], ["anonymous: 401; invalid target/value/URL: 400/404; 1000-run storage cap: 409"]),
  route("GET", "/me/personal-runs", ["authenticated owner; descending cursor pagination"], [
    "anonymous: 401; invalid cursor: 400",
  ]),
  route("GET", "/me/personal-runs/bests", ["authenticated owner receives one PB per exact board"], [
    "anonymous: 401",
  ]),
  route("PATCH", "/me/personal-runs/:id", ["owner updates an unpromoted run with a non-empty patch"], [
    "anonymous: 401; invalid/empty payload: 400; hidden run: 404; promoted run: 409",
  ]),
  route("DELETE", "/me/personal-runs/:id", ["owner deletes an unpromoted run"], [
    "anonymous: 401; invalid/hidden run: 400/404; promoted run: 409",
  ]),
  route("POST", "/me/personal-runs/:id/promote", [
    "owner atomically snapshots a proof-backed solo run into one pending official submission",
  ], ["anonymous: 401; invalid/missing proof: 400; hidden run: 404; duplicate/capacity conflict: 409"]),
  route("GET", "/users/:id/personal-runs", [
    "public runs for anonymous users; follower runs for followers; all runs for owner",
  ], ["unknown user: 404; invalid cursor: 400"]),
  route("POST", "/admin/client-versions", ["admin registers one protocol-compatible client release"], [
    "anonymous: 401; non-admin: 403; invalid version: 400; duplicate: 409",
  ]),
  route("GET", "/admin/client-versions", ["admin lists allowed and revoked releases"], [
    "anonymous: 401; non-admin: 403",
  ]),
  route("PATCH", "/admin/client-versions/:id", ["admin allows or revokes a client release"], [
    "anonymous: 401; non-admin: 403; invalid/unknown version: 400/404",
  ]),
  route("POST", "/me/client-installations", ["owner registers an Ed25519 public key for one installation"], [
    "anonymous: 401; malformed name or key: 400",
  ]),
  route("GET", "/me/client-installations", ["owner lists only their installation metadata"], [
    "anonymous: 401",
  ]),
  route("DELETE", "/me/client-installations/:id", [
    "owner revokes their installation without deleting audit data",
  ], [
    "anonymous: 401; hidden installation: 404",
  ]),
  route("POST", "/me/client-runs", [
    "owner idempotently starts an unlimited-duration run bound to their installation, version and token",
  ], [
    "anonymous: 401; invalid signature/target/token: 400/404; duplicate/revoked: 409; excessive new runs only: 429",
  ]),
  route(
    "GET",
    "/me/client-runs/:id",
    ["owner reads durable state, chunk manifest and generated submissions"],
    [
      "anonymous: 401; hidden run: 404",
    ],
  ),
  route("POST", "/me/client-runs/:id/heartbeat", [
    "owner advances signed heartbeat sequence, game duration and round without any absolute run expiry",
  ], ["anonymous: 401; invalid token/signature/state: 400; hidden run: 404; regressed or closed run: 409"]),
  route("POST", "/me/client-runs/:id/chunks", [
    "owner appends one idempotent gzip events-v1 chunk to the strict SHA-256 chain",
  ], [
    "anonymous: 401; invalid gzip/hash/signature/size: 400; hidden run: 404; timeline/sequence/closed conflict: 409",
  ]),
  route("POST", "/me/client-runs/:id/recover", [
    "owner proves possession of the installation key and rotates a lost run token after a client or game crash",
  ], ["anonymous: 401; invalid signature: 400; hidden run: 404; revoked or closed run: 409"]),
  route("POST", "/me/client-runs/:id/finalize", [
    "owner normally or interrupted-finalizes a signed run into one idempotent 1-to-5 submission group",
  ], [
    "anonymous: 401; invalid final state/signature/entries: 400; hidden run: 404; abandoned/processing conflict: 409",
  ]),
  route("POST", "/me/client-runs/:id/abandon", [
    "owner explicitly closes a reset attempt without deleting evidence",
  ], [
    "anonymous: 401; invalid token/signature: 400; hidden run: 404; closed run: 409",
  ]),
  route("POST", "/clans", ["authenticated user without a clan; valid name; server-generated slug"], [
    "anonymous: 401; invalid payload: 400; existing membership: 409",
  ]),
  route("GET", "/clans/:slug", ["existing public clan slug"], ["unknown clan: 404"]),
  route("GET", "/me/clan", ["authenticated user, with or without a clan"], ["anonymous: 401"]),
  route("PATCH", "/me/clan-preferences", ["authenticated user; boolean autoAcceptClanRuns"], [
    "anonymous: 401; invalid payload: 400",
  ]),
  route("GET", "/me/clan-preferences", ["authenticated user receives autoAcceptClanRuns"], [
    "anonymous: 401",
  ]),
  route("POST", "/clans/:id/invitations", ["owner/admin; existing clanless target user"], [
    "anonymous: 401; non-member: 404; insufficient clan role or duplicate/already-member target: 409",
  ]),
  route("GET", "/clans/:id/invitations", ["owner/admin receives the latest 100 clan invitations"], [
    "anonymous: 401; missing membership: 404; insufficient clan role: 409",
  ]),
  route("GET", "/me/clan-invitations", ["authenticated user receives active pending invitations"], [
    "anonymous: 401",
  ]),
  route("PATCH", "/me/clan-invitations/:id", ["invited user accepts or rejects pending invitation"], [
    "anonymous: 401; hidden invitation: 404; expired/reviewed/already member: 409; invalid decision: 400",
  ]),
  route("DELETE", "/clans/:clanId/invitations/:invitationId", ["owner/admin revokes pending invitation"], [
    "anonymous: 401; missing clan membership/invitation: 404; insufficient role or completed invite: 409",
  ]),
  route("PATCH", "/clans/:clanId/members/:userId/role", ["owner promotes/demotes admin/member"], [
    "anonymous: 401; missing membership: 404; non-owner or owner target: 409; invalid role: 400",
  ]),
  route("PATCH", "/clans/:id/owner", ["owner transfers ownership to an active clan member"], [
    "anonymous: 401; missing membership: 404; non-owner or invalid target: 409/400",
  ]),
  route("DELETE", "/clans/:clanId/members/:userId", [
    "non-owner leaves; admin removes member; owner removes admin/member",
  ], ["anonymous: 401; missing membership: 404; owner departure or insufficient clan role: 409"]),
  route("GET", "/clans/:id/audit-events", ["owner/admin receives the latest 100 clan events"], [
    "anonymous: 401; missing membership: 404; insufficient clan role: 409",
  ]),
  route("PATCH", "/admin/users/:id/roles", ["user:roles grant; existing user; non-empty valid role list"], [
    "unknown user: 404; empty/invalid roles: 400",
  ]),
  route("GET", "/admin/badges", ["user:roles grant; all badge definitions"], [
    "anonymous: 401; no grant: 403",
  ]),
  route("POST", "/admin/badges", ["user:roles grant; unique valid badge definition"], [
    "anonymous: 401; no grant: 403; duplicate slug: 409; invalid body: 400",
  ]),
  route("PUT", "/admin/users/:id/badges/:badgeId", [
    "user:roles grant; existing user and badge",
  ], ["anonymous: 401; no grant: 403; unknown user or badge: 404"]),
  route("DELETE", "/admin/users/:id/badges/:badgeId", [
    "user:roles grant; existing or absent assignment",
  ], ["anonymous: 401; no grant: 403; invalid badge id: 400"]),
  route("POST", "/me/goals", [
    "authenticated user; global PP/submission goal or exact round/time/rank board goal with positive target",
  ], [
    "anonymous: 401; invalid payload/date/board/category metric: 400",
  ]),
  route("GET", "/me/goals", ["authenticated owner; live metric progress"], ["anonymous: 401"]),
  route("PATCH", "/me/goals/:id", ["authenticated owner activates or abandons a goal"], [
    "anonymous: 401; invalid status/id: 400; hidden goal: 404",
  ]),
  route("GET", "/achievements", ["active definitions; authenticated progress and persisted unlock date"], []),
  route("GET", "/leaderboard/achievements", [
    "players ranked by achievement points; optional country and zero-based page",
  ], ["invalid country or page: 400"]),
  route("GET", "/users/:id/achievements", ["public achievement progress for a player id"], []),
  route("POST", "/admin/achievements", ["admin; unique slug, supported metric and positive threshold"], [
    "anonymous/non-admin: 401/403; invalid definition: 400; duplicate slug: 409",
  ]),
  route("POST", "/admin/achievements/recalculate", [
    "admin; recalculates and persists every active achievement for every non-deleted player",
  ], ["anonymous/non-admin: 401/403"]),
  route("GET", "/challenges", ["active challenges; authenticated progress inside challenge window"], []),
  route("POST", "/admin/challenges", ["admin; unique slug, valid time window and positive target"], [
    "anonymous/non-admin: 401/403; invalid definition/window: 400; duplicate slug: 409",
  ]),
  route("GET", "/admin/moderation/overview", [
    "submission:review grant; queue counts and oldest pending item",
  ], [
    "anonymous/no grant: 401/403",
  ]),
] as const satisfies ReadonlyArray<RouteContract>;

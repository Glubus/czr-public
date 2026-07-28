import { openApiSchemas } from "./openapi-components.ts";

const schemaRef = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (name: string) => ({ content: { "application/json": { schema: schemaRef(name) } } });
const errors = {
  "400": { description: "Invalid request", ...json("Problem") },
  "401": { description: "Missing or invalid bearer token", ...json("Problem") },
  "403": { description: "Insufficient role", ...json("Problem") },
  "404": { description: "Resource not found", ...json("Problem") },
  "409": { description: "Conflict / protected deletion", ...json("Problem") },
  "413": { description: "Request body too large", ...json("Problem") },
  "429": { description: "Rate limit exceeded", ...json("Problem") },
  "500": { description: "Unexpected server error", ...json("Problem") },
};
const bearer = [{ bearerAuth: [] }];
const id = (name = "id") => ({ name, in: "path", required: true, schema: { type: "integer", minimum: 1 } });
const slug = { name: "slug", in: "path", required: true, schema: { type: "string" } };
const body = (schema: string, required: string[]) => ({
  required: true,
  content: {
    "application/json": {
      schema: {
        ...schemaRef(schema),
        description: required.length === 0 ? "JSON object" : `Required fields: ${required.join(", ")}`,
      },
    },
  },
});
const read = (summary: string, parameters: unknown[] = []) => ({
  summary,
  parameters,
  responses: { "200": { description: "Success", ...json(responseSchemas[summary]!) }, ...errors },
});
const write = (summary: string, required: string[], status = "200") => ({
  summary,
  security: bearer,
  requestBody: body(requestSchemas[summary]!, required),
  responses: { [status]: { description: "Success", ...json(responseSchemas[summary]!) }, ...errors },
});
const remove = (summary: string) => ({
  summary,
  security: bearer,
  responses: { "200": { description: "Deleted", ...json(responseSchemas[summary]!) }, ...errors },
});
const action = (summary: string, status = "200") => ({
  summary,
  security: bearer,
  responses: { [status]: { description: "Success", ...json(responseSchemas[summary]!) }, ...errors },
});

const requestSchemas: Record<string, string> = {
  "Create account": "AuthSignUpRequest",
  "Sign in": "AuthSignInRequest",
  "Sign out": "EmptyObject",
  "Send verification email": "SendVerificationEmailRequest",
  "Request password reset": "RequestPasswordResetRequest",
  "Reset password": "ResetPasswordRequest",
  "Change password": "ChangePasswordRequest",
  "Update own profile": "ProfileUpdateRequest",
  "Delete own account": "AccountDeleteRequest",
  "Create pending submission": "SubmissionCreateRequest",
  "Create grouped submissions": "SubmissionGroupCreateRequest",
  "Preview external map import": "MapPreviewRequest",
  "Create game": "GameCreateRequest",
  "Edit or activate game": "GameUpdateRequest",
  "Create map": "MapCreateRequest",
  "Edit map and replace sources": "MapUpdateRequest",
  "Archive/publish map": "MapStatusRequest",
  "Create mod": "ModCreateRequest",
  "Edit mod": "ModUpdateRequest",
  "Set user roles": "UserRoleUpdateRequest",
  "Create badge": "BadgeCreateRequest",
  "Create category": "CategoryCreateRequest",
  "Edit category rules": "CategoryUpdateRequest",
  "Assign category": "CategoryAssignmentCreateRequest",
  "Edit assignment rules": "CategoryAssignmentUpdateRequest",
  "Verify or reject submission": "SubmissionReviewRequest",
  "Claim imported profile": "ProfileClaimCreateRequest",
  "Review profile claim": "ProfileClaimReviewRequest",
  "Create clan": "ClanCreateRequest",
  "Invite clan member": "ClanInviteRequest",
  "Answer clan invitation": "ClanInvitationDecisionRequest",
  "Update clan member role": "ClanMemberRoleRequest",
  "Transfer clan ownership": "ClanOwnershipTransferRequest",
  "Update clan preferences": "ClanPreferencesRequest",
  "Answer participation invitation": "ParticipationInvitationDecisionRequest",
  "Follow target": "FollowCreateRequest",
  "Create personal run": "PersonalRunCreateRequest",
  "Update personal run": "PersonalRunUpdateRequest",
  "Register client version": "ClientVersionCreateRequest",
  "Update client version": "ClientVersionUpdateRequest",
  "Register client installation": "ClientInstallationCreateRequest",
  "Start client run": "ClientRunStartRequest",
  "Client run heartbeat": "ClientRunHeartbeatRequest",
  "Append client run chunk": "ClientRunChunkRequest",
  "Recover client run": "ClientRunRecoveryRequest",
  "Finalize client run": "ClientRunFinalizeRequest",
  "Abandon client run": "ClientRunAbandonRequest",
  "Create goal": "GoalCreateRequest",
  "Update goal": "GoalUpdateRequest",
  "Create achievement": "AchievementCreateRequest",
  "Create challenge": "ChallengeCreateRequest",
};

const responseSchemas: Record<string, string> = {
  "Health check": "Health",
  "OpenAPI contract": "OpenApiDocument",
  "Platform statistics": "PlatformStats",
  "Category collection": "CategorySummaryList",
  "Category definition collection": "CategoryDefinitionList",
  "Highest PP records": "HighestPointRecords",
  "Latest world records": "HighestPointRecords",
  "Weekly highest PP records": "WeeklyPointRecords",
  "Highest average PP leaderboard": "HighestAverageLeaderboard",
  "Achievement points leaderboard": "AchievementLeaderboard",
  "Create account": "AuthResponse",
  "Sign in": "AuthResponse",
  "Sign out": "EmptyObject",
  "Current session": "SessionResponse",
  "Verify email": "AccountActionResponse",
  "Send verification email": "AccountActionResponse",
  "Request password reset": "AccountActionResponse",
  "Reset password": "AccountActionResponse",
  "Change password": "AccountActionResponse",
  "Update own profile": "ProfileUpdateResponse",
  "Pin profile record": "AccountActionResponse",
  "Unpin profile record": "AccountActionResponse",
  "Upload media": "MediaUploadResponse",
  "Delete own account": "AccountDeleteResponse",
  "Paginated games": "PaginatedGames",
  "Game detail": "Game",
  "Map collection": "MapCollection",
  "Game mods": "ModList",
  "Map detail": "Map",
  "Map categories": "CategoryList",
  "Map category leaderboard": "MapLeaderboard",
  "Preview external map import": "MapImportPreview",
  "Global performance leaderboard": "PerformanceLeaderboard",
  "Clan leaderboard": "ClanLeaderboard",
  "User collection": "UserCollection",
  "User records": "UserRecords",
  "User history": "UserHistory",
  "User performance history": "PerformanceHistory",
  "User scoped ranks": "UserScopedRanks",
  "User social context": "UserSocialContext",
  "Compare user profiles": "ProfileComparison",
  "Exact roster leaderboard": "RosterLeaderboard",
  "Exact roster detail": "RosterSummary",
  "Exact roster records": "RosterRecords",
  "Create pending submission": "Submission",
  "Public submission detail": "SubmissionDetail",
  "Create grouped submissions": "SubmissionGroupResponse",
  "Own paginated submissions": "SubmissionPage",
  "Create game": "Game",
  "Edit or activate game": "Game",
  "Create map": "Map",
  "Edit map and replace sources": "Map",
  "Archive/publish map": "Map",
  "Create mod": "Mod",
  "Edit mod": "Mod",
  "Delete unused mod": "Mod",
  "Set user roles": "UserRoles",
  "Badge collection": "BadgeList",
  "User badges": "BadgeList",
  "Create badge": "Badge",
  "Assign user badge": "BadgeList",
  "Remove user badge": "AccountActionResponse",
  "Create category": "Category",
  "Edit category rules": "Category",
  "Delete unused category": "Category",
  "Assign category": "CategoryAssignment",
  "Category assignment collection": "CategoryAssignmentCollection",
  "Edit assignment rules": "CategoryAssignment",
  "Delete unused assignment": "CategoryAssignment",
  "Moderation queue": "SubmissionPage",
  "Submission moderation detail": "SubmissionDetail",
  "Verify or reject submission": "SubmissionReviewResult",
  "Claim imported profile": "ProfileClaim",
  "Own profile claims": "ProfileClaimList",
  "Profile claim moderation queue": "ProfileClaimList",
  "Review profile claim": "ProfileClaim",
  "Create clan": "Clan",
  "Clan detail": "Clan",
  "Own clan": "OwnClan",
  "Invite clan member": "ClanInvitation",
  "Own clan invitations": "ClanInvitationList",
  "Clan invitations": "ClanManagedInvitationList",
  "Answer clan invitation": "ClanInvitationDecision",
  "Revoke clan invitation": "ClanInvitation",
  "Update clan member role": "ClanMembership",
  "Transfer clan ownership": "Clan",
  "Remove clan member": "ClanMemberRemoval",
  "Update clan preferences": "ClanPreferences",
  "Own clan preferences": "ClanPreferences",
  "Clan audit events": "ClanAuditEventList",
  "Own participation invitations": "ParticipationInvitationList",
  "Answer participation invitation": "ParticipationGroup",
  "Follow target": "Follow",
  "Unfollow target": "RemovalResult",
  "Own follows": "FollowList",
  "Own feed": "FeedPage",
  "Own notifications": "NotificationPage",
  "Unread notification count": "NotificationCount",
  "Read notification": "Notification",
  "Read all notifications": "NotificationReadAll",
  "Create personal run": "PersonalRun",
  "Own personal runs": "PersonalRunPage",
  "Public personal runs": "PersonalRunPage",
  "Personal bests": "PersonalBestList",
  "Update personal run": "PersonalRun",
  "Delete personal run": "RemovalResult",
  "Promote personal run": "PersonalRunPromotion",
  "Register client version": "ClientVersion",
  "Client versions": "ClientVersionList",
  "Update client version": "ClientVersion",
  "Register client installation": "ClientInstallation",
  "Client installations": "ClientInstallationList",
  "Revoke client installation": "ClientInstallationRevocation",
  "Start client run": "ClientRunMutationResult",
  "Client run detail": "ClientRunDetail",
  "Client run heartbeat": "ClientRunMutationResult",
  "Append client run chunk": "ClientRunChunkResult",
  "Recover client run": "ClientRunRecovery",
  "Finalize client run": "ClientRunFinalization",
  "Abandon client run": "ClientRun",
  "Create goal": "Goal",
  "Own goals": "GoalList",
  "Update goal": "Goal",
  "Achievements": "AchievementList",
  "Create achievement": "Achievement",
  "Challenges": "ChallengeList",
  "Create challenge": "Challenge",
  "Moderation overview": "ModerationOverview",
};

/** Checked-in contract for every route mounted in src/http/app.ts. */
export const openApiDocument = {
  openapi: "3.1.0",
  info: { title: "ZWR API", version: "1.0.0", description: "Zombies records API. All bodies are JSON." },
  servers: [{ url: "/v1", description: "Version 1" }],
  paths: {
    "/health": { get: { ...read("Health check"), servers: [{ url: "/" }] } },
    "/stats": { get: read("Platform statistics") },
    "/metrics": {
      get: {
        summary: "Prometheus metrics",
        servers: [{ url: "/" }],
        responses: {
          "200": {
            description: "Prometheus exposition format",
            content: { "text/plain": { schema: { type: "string" } } },
          },
        },
      },
    },
    "/openapi.json": { get: read("OpenAPI contract") },
    "/auth/sign-up": { post: { ...write("Create account", ["email", "password", "name"]), security: [] } },
    "/auth/sign-in": { post: { ...write("Sign in", ["email", "password"]), security: [] } },
    "/auth/sign-out": { post: write("Sign out", []) },
    "/auth/session": { get: { ...read("Current session"), security: bearer } },
    "/auth/request-password-reset": {
      post: { ...write("Request password reset", ["email", "redirectTo"]), security: [] },
    },
    "/auth/reset-password": {
      post: { ...write("Reset password", ["token", "newPassword"]), security: [] },
    },
    "/auth/change-password": { post: write("Change password", ["currentPassword", "newPassword"]) },
    "/games": {
      get: read("Paginated games", [
        { name: "search", in: "query", schema: { type: "string" } },
        { name: "page", in: "query", schema: { type: "integer", minimum: 0 } },
      ]),
    },
    "/games/{slug}": { get: read("Game detail", [slug]) },
    "/maps": {
      get: read("Map collection", [
        { name: "name", in: "query", schema: { type: "string" } },
        { name: "search", in: "query", schema: { type: "string" } },
        { name: "game", in: "query", schema: { type: "string" } },
        {
          name: "page",
          in: "query",
          schema: { type: "integer", minimum: 0 },
        },
      ]),
    },
    "/games/{slug}/mods": { get: read("Game mods", [slug]) },
    "/categories": { get: read("Category collection") },
    "/records/highest-pp": {
      get: read("Highest PP records", [
        { name: "categories", in: "query", schema: { type: "string" } },
        { name: "game", in: "query", schema: { type: "string" } },
        { name: "maps_status", in: "query", schema: { enum: ["official", "community"] } },
      ]),
    },
    "/records/latest-world-records": { get: read("Latest world records") },
    "/records/highest-pp-week": { get: read("Weekly highest PP records") },
    "/leaderboard/highest-average": {
      get: read("Highest average PP leaderboard", [
        { name: "categories", in: "query", schema: { type: "string" } },
        { name: "game", in: "query", schema: { type: "string" } },
        { name: "maps_status", in: "query", schema: { enum: ["official", "community"] } },
      ]),
    },
    "/leaderboard/achievements": {
      get: read("Achievement points leaderboard", [
        { name: "country", in: "query", schema: { type: "string", pattern: "^[A-Za-z]{2}$" } },
        { name: "page", in: "query", schema: { type: "integer", minimum: 0 } },
      ]),
    },
    "/maps/{id}": { get: read("Map detail", [id()]) },
    "/maps/{id}/categories": { get: read("Map categories", [id()]) },
    "/maps/{mapId}/categories/{categoryId}/leaderboard": {
      get: read("Map category leaderboard", [
        id("mapId"),
        id("categoryId"),
        { name: "player_count", in: "query", schema: { type: "integer", minimum: 1 } },
        { name: "assignment_id", in: "query", schema: { type: "integer", minimum: 1 } },
        { name: "page", in: "query", schema: { type: "integer", minimum: 0 } },
      ]),
    },
    "/maps/preview": { post: write("Preview external map import", ["url"]) },
    "/leaderboard": {
      get: read("Global performance leaderboard", [
        { name: "categories", in: "query", schema: { type: "string" } },
        { name: "game", in: "query", schema: { type: "string" } },
        { name: "maps_status", in: "query", schema: { enum: ["official", "community"] } },
        { name: "player_count", in: "query", schema: { type: "integer", minimum: 1 } },
        { name: "scope", in: "query", schema: { enum: ["world", "following", "friends"] } },
        { name: "country", in: "query", schema: { type: "string", pattern: "^[A-Za-z]{2}$" } },
        { name: "page", in: "query", schema: { type: "integer", minimum: 0 } },
      ]),
    },
    "/clans/leaderboard": {
      get: read("Clan leaderboard", [
        { name: "categories", in: "query", schema: { type: "string" } },
        { name: "game", in: "query", schema: { type: "string" } },
        { name: "maps_status", in: "query", schema: { enum: ["official", "community"] } },
        { name: "player_count", in: "query", schema: { type: "integer", enum: [1, 2, 3, 4] } },
        { name: "page", in: "query", schema: { type: "integer", minimum: 0 } },
      ]),
    },
    "/teams/leaderboard": {
      get: read("Exact roster leaderboard", [
        { name: "player_count", in: "query", required: true, schema: { type: "integer", enum: [2, 3, 4] } },
        { name: "categories", in: "query", schema: { type: "string" } },
        { name: "game", in: "query", schema: { type: "string" } },
        { name: "maps_status", in: "query", schema: { enum: ["official", "community"] } },
        { name: "page", in: "query", schema: { type: "integer", minimum: 0 } },
      ]),
    },
    "/teams/{competitorKey}": {
      get: read("Exact roster detail", [{
        name: "competitorKey",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^team:" },
      }]),
    },
    "/teams/{competitorKey}/records": {
      get: read("Exact roster records", [{
        name: "competitorKey",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^team:" },
      }, { name: "page", in: "query", schema: { type: "integer", minimum: 0 } }]),
    },
    "/users": {
      get: read("User collection", [
        { name: "search", in: "query", schema: { type: "string" } },
        { name: "page", in: "query", schema: { type: "integer", minimum: 0 } },
      ]),
    },
    "/users/{id}/records": {
      get: read("User records", [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
        { name: "page", in: "query", schema: { type: "integer", minimum: 0 } },
      ]),
    },
    "/users/{id}/badges": {
      get: read("User badges", [{
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
      }]),
    },
    "/users/{id}/history": {
      get: read("User history", [{
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
      }, { name: "page", in: "query", schema: { type: "integer", minimum: 0 } }]),
    },
    "/users/{id}/performance-history": {
      get: read("User performance history", [{
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
      }]),
    },
    "/users/{id}/ranks": {
      get: read("User scoped ranks", [{
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
      }]),
    },
    "/users/{id}/social-context": {
      get: read("User social context", [{
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
      }]),
    },
    "/users/{id}/compare/{otherId}": {
      get: read("Compare user profiles", [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
        { name: "otherId", in: "path", required: true, schema: { type: "string" } },
      ]),
    },
    "/clans": { post: write("Create clan", ["name"], "201") },
    "/clans/{slug}": { get: read("Clan detail", [slug]) },
    "/me/clan": { get: { ...read("Own clan"), security: bearer } },
    "/me/clan-preferences": {
      get: { ...read("Own clan preferences"), security: bearer },
      patch: write("Update clan preferences", ["autoAcceptClanRuns"]),
    },
    "/clans/{id}/invitations": {
      get: { ...read("Clan invitations", [id()]), security: bearer },
      post: { ...write("Invite clan member", ["userId"], "201"), parameters: [id()] },
    },
    "/me/clan-invitations": { get: { ...read("Own clan invitations"), security: bearer } },
    "/me/clan-invitations/{id}": {
      patch: { ...write("Answer clan invitation", ["status"]), parameters: [id()] },
    },
    "/clans/{clanId}/invitations/{invitationId}": {
      delete: {
        ...remove("Revoke clan invitation"),
        parameters: [id("clanId"), id("invitationId")],
      },
    },
    "/clans/{clanId}/members/{userId}/role": {
      patch: {
        ...write("Update clan member role", ["role"]),
        parameters: [
          id("clanId"),
          { name: "userId", in: "path", required: true, schema: { type: "string" } },
        ],
      },
    },
    "/clans/{id}/owner": {
      patch: { ...write("Transfer clan ownership", ["userId"]), parameters: [id()] },
    },
    "/clans/{clanId}/members/{userId}": {
      delete: {
        ...remove("Remove clan member"),
        parameters: [
          id("clanId"),
          { name: "userId", in: "path", required: true, schema: { type: "string" } },
        ],
      },
    },
    "/clans/{id}/audit-events": {
      get: { ...read("Clan audit events", [id()]), security: bearer },
    },
    "/submissions": {
      post: write("Create pending submission", [
        "gameId",
        "mapId",
        "categoryAssignmentId",
        "scoreValue",
        "proofLevel",
      ], "201"),
    },
    "/submissions/{id}": { get: read("Public submission detail", [id()]) },
    "/submission-groups": {
      post: write("Create grouped submissions", ["gameId", "mapId", "proofLevel", "entries"], "201"),
    },
    "/me/submissions": {
      get: {
        ...read("Own paginated submissions", [
          {
            name: "status",
            in: "query",
            schema: {
              enum: ["awaiting_participants", "pending", "verified", "rejected", "cancelled"],
            },
          },
          { name: "mapId", in: "query", schema: { type: "integer" } },
          { name: "categoryId", in: "query", schema: { type: "integer" } },
          { name: "groupId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "page", in: "query", schema: { type: "integer" } },
        ]),
        security: bearer,
      },
    },
    "/me/participation-invitations": {
      get: { ...read("Own participation invitations"), security: bearer },
    },
    "/me/participation-invitations/{id}": {
      patch: { ...write("Answer participation invitation", ["status"]), parameters: [id()] },
    },
    "/profile-claims": {
      post: write("Claim imported profile", ["profileUserId", "proofUrl"], "201"),
    },
    "/me/profile-claims": {
      get: { ...read("Own profile claims"), security: bearer },
    },
    "/me/profile": { patch: write("Update own profile", []) },
    "/me/pinned-records/{submissionId}": {
      put: { ...action("Pin profile record"), parameters: [id("submissionId")] },
      delete: { ...remove("Unpin profile record"), parameters: [id("submissionId")] },
    },
    "/submissions/{id}/comments": {
      get: read("List record comments"),
      post: { ...write("Comment on a record", ["body"], "201"), parameters: [id()] },
    },
    "/submissions/{id}/comments/{commentId}": {
      delete: {
        ...write("Delete own record comment", []),
        parameters: [id(), id("commentId")],
      },
    },
    "/submissions/{id}/comments/{commentId}/vote": {
      put: {
        ...write("Vote on a record comment", ["value"]),
        parameters: [id(), id("commentId")],
      },
    },
    "/me/media/{kind}": {
      post: {
        ...write("Upload media", []),
        parameters: [{
          name: "kind",
          in: "path",
          required: true,
          schema: { enum: ["avatar", "profile-background", "clan-logo", "clan-background"] },
        }],
        requestBody: {
          required: true,
          content: {
            "image/jpeg": { schema: { type: "string", format: "binary" } },
            "image/png": { schema: { type: "string", format: "binary" } },
            "image/webp": { schema: { type: "string", format: "binary" } },
            "image/gif": { schema: { type: "string", format: "binary" } },
          },
        },
      },
    },
    "/media/{path}": {
      get: {
        summary: "Hosted media",
        parameters: [{ name: "path", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Hosted image bytes",
            content: { "image/*": { schema: { type: "string", format: "binary" } } },
          },
          ...errors,
        },
      },
    },
    "/me/account": { delete: write("Delete own account", ["confirmation", "password"]) },
    "/me/follows": {
      post: write("Follow target", ["targetType", "targetId"], "201"),
      get: {
        ...read("Own follows", [{
          name: "type",
          in: "query",
          schema: { enum: ["user", "game", "map", "category_assignment", "team"] },
        }]),
        security: bearer,
      },
    },
    "/me/follows/{targetType}/{targetId}": {
      delete: {
        ...remove("Unfollow target"),
        parameters: [
          {
            name: "targetType",
            in: "path",
            required: true,
            schema: { enum: ["user", "game", "map", "category_assignment", "team"] },
          },
          { name: "targetId", in: "path", required: true, schema: { type: "string" } },
        ],
      },
    },
    "/me/feed": {
      get: {
        ...read("Own feed", [
          { name: "cursor", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "type", in: "query", schema: { type: "string" } },
        ]),
        security: bearer,
      },
    },
    "/me/notifications": {
      get: {
        ...read("Own notifications", [
          { name: "cursor", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "unread", in: "query", schema: { type: "boolean" } },
          { name: "type", in: "query", schema: { type: "string" } },
        ]),
        security: bearer,
      },
    },
    "/me/notifications/unread-count": {
      get: { ...read("Unread notification count"), security: bearer },
    },
    "/me/notifications/{id}/read": {
      patch: { ...remove("Read notification"), parameters: [id()] },
    },
    "/me/notifications/read-all": { post: remove("Read all notifications") },
    "/me/personal-runs": {
      post: write("Create personal run", ["gameId", "mapId", "categoryAssignmentId", "scoreValue"], "201"),
      get: {
        ...read("Own personal runs", [{
          name: "cursor",
          in: "query",
          schema: { type: "integer", minimum: 1 },
        }]),
        security: bearer,
      },
    },
    "/me/personal-runs/bests": { get: { ...read("Personal bests"), security: bearer } },
    "/me/personal-runs/{id}": {
      patch: { ...write("Update personal run", []), parameters: [id()] },
      delete: { ...remove("Delete personal run"), parameters: [id()] },
    },
    "/me/personal-runs/{id}/promote": {
      post: { ...action("Promote personal run", "201"), parameters: [id()] },
    },
    "/users/{id}/personal-runs": {
      get: read("Public personal runs", [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
        { name: "cursor", in: "query", schema: { type: "integer", minimum: 1 } },
      ]),
    },
    "/me/client-installations": {
      post: write("Register client installation", ["name", "publicKeySpki"], "201"),
      get: { ...read("Client installations"), security: bearer },
    },
    "/me/client-installations/{id}": {
      delete: {
        ...remove("Revoke client installation"),
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      },
    },
    "/me/client-runs": {
      post: write("Start client run", [
        "runId",
        "runToken",
        "installationId",
        "clientName",
        "clientVersion",
        "protocolVersion",
        "gameId",
        "mapId",
        "signature",
      ], "201"),
    },
    "/me/client-runs/{id}": {
      get: {
        ...read("Client run detail", [{
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        }]),
        security: bearer,
      },
    },
    "/me/client-runs/{id}/heartbeat": {
      post: {
        ...write("Client run heartbeat", [
          "runToken",
          "sequence",
          "gameElapsedMs",
          "observedAt",
          "signature",
        ]),
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      },
    },
    "/me/client-runs/{id}/chunks": {
      post: {
        ...write("Append client run chunk", [
          "runToken",
          "sequence",
          "startElapsedMs",
          "endElapsedMs",
          "compression",
          "payloadFormat",
          "compressedSha256",
          "uncompressedSha256",
          "compressedDataBase64",
          "signature",
        ], "201"),
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      },
    },
    "/me/client-runs/{id}/recover": {
      post: {
        ...write("Recover client run", ["signature"]),
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      },
    },
    "/me/client-runs/{id}/finalize": {
      post: {
        ...write(
          "Finalize client run",
          ["runToken", "interrupted", "finalState", "entries", "signature"],
          "201",
        ),
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      },
    },
    "/me/client-runs/{id}/abandon": {
      post: {
        ...write("Abandon client run", ["runToken", "signature"]),
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      },
    },
    "/admin/client-versions": {
      post: write("Register client version", ["clientName", "version", "protocolVersion"], "201"),
      get: { ...read("Client versions"), security: bearer },
    },
    "/admin/client-versions/{id}": {
      patch: { ...write("Update client version", ["status"]), parameters: [id()] },
    },
    "/admin/games": { post: write("Create game", ["slug", "name", "shortName"], "201") },
    "/admin/games/{id}": { patch: { ...write("Edit or activate game", []), parameters: [id()] } },
    "/admin/maps": { post: write("Create map", ["gameId", "slug", "name", "type"], "201") },
    "/admin/maps/{id}": { patch: { ...write("Edit map and replace sources", []), parameters: [id()] } },
    "/admin/maps/{id}/status": { patch: { ...write("Archive/publish map", ["status"]), parameters: [id()] } },
    "/admin/mods": { post: write("Create mod", ["gameId", "slug", "name"], "201") },
    "/admin/mods/{id}": {
      patch: { ...write("Edit mod", ["name"]), parameters: [id()] },
      delete: { ...remove("Delete unused mod"), parameters: [id()] },
    },
    "/admin/users/{id}/roles": {
      patch: {
        ...write("Set user roles", ["roles"]),
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      },
    },
    "/admin/badges": {
      get: { ...read("Badge collection"), security: bearer },
      post: write("Create badge", ["slug", "name"], "201"),
    },
    "/admin/users/{id}/badges/{badgeId}": {
      put: {
        ...action("Assign user badge"),
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          id("badgeId"),
        ],
      },
      delete: {
        ...remove("Remove user badge"),
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          id("badgeId"),
        ],
      },
    },
    "/admin/categories": {
      get: { ...read("Category definition collection"), security: bearer },
      post: write("Create category", ["slug", "name", "scoreType", "rankingDirection"], "201"),
    },
    "/admin/categories/{id}": {
      patch: { ...write("Edit category rules", []), parameters: [id()] },
      delete: { ...remove("Delete unused category"), parameters: [id()] },
    },
    "/admin/category-assignments": {
      get: {
        ...read("Category assignment collection", [
          { name: "page", in: "query", schema: { type: "integer", minimum: 0 } },
          { name: "gameId", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "mapId", in: "query", schema: { type: "integer", minimum: 1 } },
        ]),
        security: bearer,
      },
      post: write("Assign category", ["categoryId", "gameId"], "201"),
    },
    "/admin/category-assignments/{id}": {
      patch: { ...write("Edit assignment rules", ["specificRules"]), parameters: [id()] },
      delete: { ...remove("Delete unused assignment"), parameters: [id()] },
    },
    "/admin/submissions": {
      get: {
        ...read("Moderation queue", [
          {
            name: "status",
            in: "query",
            schema: {
              enum: ["awaiting_participants", "pending", "verified", "rejected", "cancelled"],
            },
          },
          { name: "mapId", in: "query", schema: { type: "integer" } },
          { name: "categoryId", in: "query", schema: { type: "integer" } },
          { name: "groupId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "page", in: "query", schema: { type: "integer" } },
        ]),
        security: bearer,
      },
    },
    "/admin/submissions/{id}": { get: { ...read("Submission moderation detail", [id()]), security: bearer } },
    "/admin/submissions/{id}/status": {
      patch: { ...write("Verify or reject submission", ["status"]), parameters: [id()] },
    },
    "/admin/profile-claims": {
      get: {
        ...read("Profile claim moderation queue", [{
          name: "status",
          in: "query",
          schema: { enum: ["pending", "approved", "rejected"] },
        }]),
        security: bearer,
      },
    },
    "/admin/profile-claims/{id}/status": {
      patch: { ...write("Review profile claim", ["status"]), parameters: [id()] },
    },
    "/me/goals": {
      get: { ...read("Own goals"), security: bearer },
      post: write("Create goal", ["title", "metric", "targetValue"], "201"),
    },
    "/me/goals/{id}": {
      patch: { ...write("Update goal", ["status"]), parameters: [id()] },
    },
    "/achievements": { get: read("Achievements") },
    "/users/{id}/achievements": { get: read("Achievements", [id()]) },
    "/admin/achievements": {
      post: write("Create achievement", ["slug", "name", "description", "metric", "threshold"], "201"),
    },
    "/admin/achievements/recalculate": {
      post: {
        summary: "Recalculate achievements",
        security: bearer,
        responses: {
          "200": { description: "Success", ...json("AchievementRecalculation") },
          ...errors,
        },
      },
    },
    "/challenges": { get: read("Challenges") },
    "/admin/challenges": {
      post: write(
        "Create challenge",
        ["slug", "name", "description", "metric", "targetValue", "startsAt", "endsAt"],
        "201",
      ),
    },
    "/admin/moderation/overview": {
      get: { ...read("Moderation overview"), security: bearer },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
    schemas: openApiSchemas,
  },
} as const;

export const publicOpenApiPaths = [
  "/health",
  "/stats",
  "/openapi.json",
  "/games",
  "/games/{slug}",
  "/categories",
  "/records/highest-pp",
  "/records/latest-world-records",
  "/records/highest-pp-week",
  "/media/{path}",
  "/leaderboard/highest-average",
  "/maps",
  "/games/{slug}/mods",
  "/maps/{id}",
  "/maps/{id}/categories",
  "/maps/{mapId}/categories/{categoryId}/leaderboard",
  "/leaderboard",
  "/clans/leaderboard",
  "/teams/leaderboard",
  "/teams/{competitorKey}",
  "/teams/{competitorKey}/records",
  "/users",
  "/users/{id}/records",
  "/users/{id}/badges",
  "/users/{id}/history",
  "/users/{id}/performance-history",
  "/users/{id}/ranks",
  "/users/{id}/social-context",
  "/users/{id}/compare/{otherId}",
  "/submissions/{id}",
  "/users/{id}/personal-runs",
  "/clans/{slug}",
  "/achievements",
  "/challenges",
] as const satisfies ReadonlyArray<keyof typeof openApiDocument.paths>;

const publicOpenApiPathSet = new Set<string>(publicOpenApiPaths);

export const publicOpenApiDocument = {
  ...openApiDocument,
  info: {
    ...openApiDocument.info,
    description: `${openApiDocument.info.description} Only anonymously accessible operations are included.`,
  },
  paths: Object.fromEntries(
    Object.entries(openApiDocument.paths).filter(([path]) => publicOpenApiPathSet.has(path)),
  ),
};

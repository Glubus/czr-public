import { Hono } from "hono";
import type { Database } from "../../db/client.ts";
import type { BlobStore } from "../../infra/blob-store.ts";
import { mediaContentType } from "../../modules/media/service.ts";
import { getClanLeaderboard } from "../../modules/clans/leaderboard.ts";
import { getGameBySlug, listGames } from "../../modules/games/service.ts";
import { listCategories } from "../../modules/categories/service.ts";
import { getMapById, listMaps } from "../../modules/maps/service.ts";
import { listModsForGame } from "../../modules/mods/service.ts";
import { getPlatformStats } from "../../modules/platform/statistics.ts";
import {
  getHighestAverageLeaderboard,
  getHighestPointRecords,
  getHighestPointRecordsThisWeek,
  getLatestWorldRecords,
  getMapCategoryLeaderboard,
  getPerformanceLeaderboard,
  getPerformancePointHistory,
  getPublicSubmissionDetail,
  getRosterDetail,
  getRosterLeaderboard,
  getRosterRecords,
  getUserHistory,
  getUserRecords,
} from "../../modules/submissions/service.ts";
import {
  compareUsers,
  getUserScopedRanks,
  getUserSocialContext,
  listUsers,
} from "../../modules/users/service.ts";
import { listUserBadges } from "../../modules/users/badges.ts";
import type { AuthEnv } from "../../auth/authorization.ts";
import type { HttpEffectRunner } from "../route-support.ts";

/** Read-only API endpoints: no authorization decision or mutation belongs here. */
export function registerPublicRoutes(
  app: Hono<AuthEnv>,
  db: Database,
  blobStore: BlobStore,
  run: HttpEffectRunner,
) {
  app.get("/media/*", async (c) => {
    const key = c.req.path.replace(/^\/v1\/media\//, "");
    const contentType = mediaContentType(key);
    if (
      !contentType ||
      !/^(users|clans)\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/image-[A-Za-z0-9-]+\.(jpg|png|gif|webp)$/.test(key)
    ) {
      return c.json({ message: "Media not found" }, 404);
    }
    const bytes = await blobStore.get(key);
    if (!bytes) return c.json({ message: "Media not found" }, 404);
    return new Response(bytes.slice().buffer as ArrayBuffer, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  });
  app.get("/stats", (c) => run(c, getPlatformStats(db), (value) => c.json(value)));
  app.get("/categories", (c) => run(c, listCategories(db), (value) => c.json(value)));
  app.get(
    "/records/highest-pp",
    (c) =>
      run(
        c,
        getHighestPointRecords(db, {
          categories: c.req.query("categories"),
          game: c.req.query("game"),
          mapsStatus: c.req.query("maps_status"),
        }),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/records/latest-world-records",
    (c) => run(c, getLatestWorldRecords(db), (value) => c.json(value)),
  );
  app.get(
    "/records/highest-pp-week",
    (c) => run(c, getHighestPointRecordsThisWeek(db), (value) => c.json(value)),
  );
  app.get(
    "/leaderboard/highest-average",
    (c) =>
      run(
        c,
        getHighestAverageLeaderboard(db, {
          categories: c.req.query("categories"),
          game: c.req.query("game"),
          mapsStatus: c.req.query("maps_status"),
        }),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/submissions/:id",
    (c) => run(c, getPublicSubmissionDetail(db, Number(c.req.param("id"))), (value) => c.json(value)),
  );
  app.get(
    "/games",
    (c) =>
      run(
        c,
        listGames(db, { page: c.req.query("page"), search: c.req.query("search") }),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/users",
    (c) => run(c, listUsers(db, c.req.query("search"), c.req.query("page")), (value) => c.json(value)),
  );
  app.get("/games/:slug", (c) => run(c, getGameBySlug(db, c.req.param("slug")), (value) => c.json(value)));
  app.get(
    "/maps",
    (c) =>
      run(
        c,
        listMaps(db, {
          name: c.req.query("name"),
          search: c.req.query("search"),
          game: c.req.query("game"),
          page: c.req.query("page"),
        }),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/games/:slug/mods",
    (c) => run(c, listModsForGame(db, c.req.param("slug")), (value) => c.json(value)),
  );
  app.get("/maps/:id", (c) => run(c, getMapById(db, Number(c.req.param("id"))), (value) => c.json(value)));
  app.get(
    "/maps/:mapId/categories/:categoryId/leaderboard",
    (c) =>
      run(
        c,
        getMapCategoryLeaderboard(
          db,
          Number(c.req.param("mapId")),
          Number(c.req.param("categoryId")),
          positiveIntegerQuery(c.req.query("player_count")),
          c.req.query("page"),
          positiveIntegerQuery(c.req.query("assignment_id")),
        ),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/users/:id/records",
    (c) => run(c, getUserRecords(db, c.req.param("id"), c.req.query("page")), (value) => c.json(value)),
  );
  app.get(
    "/users/:id/badges",
    (c) => run(c, listUserBadges(db, c.req.param("id")), (value) => c.json(value)),
  );
  app.get(
    "/leaderboard",
    (c) =>
      run(
        c,
        getPerformanceLeaderboard(db, {
          categories: c.req.query("categories"),
          game: c.req.query("game"),
          mapsStatus: c.req.query("maps_status"),
          playerCount: c.req.query("player_count"),
          page: c.req.query("page"),
          scope: c.req.query("scope"),
          country: c.req.query("country"),
        }, c.get("currentUser")?.id),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/clans/leaderboard",
    (c) =>
      run(
        c,
        getClanLeaderboard(db, {
          categories: c.req.query("categories"),
          game: c.req.query("game"),
          mapsStatus: c.req.query("maps_status"),
          playerCount: c.req.query("player_count"),
          page: c.req.query("page"),
        }),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/teams/leaderboard",
    (c) =>
      run(
        c,
        getRosterLeaderboard(db, {
          playerCount: c.req.query("player_count"),
          categories: c.req.query("categories"),
          game: c.req.query("game"),
          mapsStatus: c.req.query("maps_status"),
          page: c.req.query("page"),
        }),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/teams/:competitorKey",
    (c) => run(c, getRosterDetail(db, c.req.param("competitorKey")), (value) => c.json(value)),
  );
  app.get(
    "/teams/:competitorKey/records",
    (c) =>
      run(
        c,
        getRosterRecords(db, c.req.param("competitorKey"), c.req.query("page")),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/users/:id/history",
    (c) =>
      run(
        c,
        getUserHistory(db, c.req.param("id"), c.req.query("page")),
        (value) => c.json(value),
      ),
  );
  app.get(
    "/users/:id/performance-history",
    (c) => run(c, getPerformancePointHistory(db, c.req.param("id")), (value) => c.json(value)),
  );
  app.get(
    "/users/:id/ranks",
    (c) => run(c, getUserScopedRanks(db, c.req.param("id")), (value) => c.json(value)),
  );
  app.get(
    "/users/:id/social-context",
    (c) => run(c, getUserSocialContext(db, c.req.param("id")), (value) => c.json(value)),
  );
  app.get(
    "/users/:id/compare/:otherId",
    (c) =>
      run(
        c,
        compareUsers(db, c.req.param("id"), c.req.param("otherId")),
        (value) => c.json(value),
      ),
  );
}

function positiveIntegerQuery(value: string | undefined) {
  return value !== undefined && /^[1-9][0-9]*$/.test(value) ? Number(value) : undefined;
}

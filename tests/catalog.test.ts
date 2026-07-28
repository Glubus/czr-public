import { assert, assertEquals } from "@std/assert";
import { createCategory, createCategoryAssignment, createGame, createMap, setup } from "./helpers.ts";

Deno.test("Steam and UGX import previews require ROLE_MAP_NOMINATOR", async () => {
  const { app, headers } = await setup(["ROLE_USER", "ROLE_MAP_NOMINATOR"]);
  const steam = await app.request("/maps/preview", {
    method: "POST",
    headers,
    body: JSON.stringify({ url: "https://steamcommunity.com/sharedfiles/filedetails/?id=123456789" }),
  });
  assertEquals(steam.status, 200);
  assertEquals((await steam.json()).externalId, "123456789");

  const ugx = await app.request("/maps/preview", {
    method: "POST",
    headers,
    body: JSON.stringify({ url: "https://www.ugx-mods.com/forum/map-releases/29/example-map/12345/" }),
  });
  assertEquals(ugx.status, 200);
  assertEquals((await ugx.json()).source, "ugx");

  const { app: adminApp, headers: adminHeaders } = await setup(["ROLE_USER", "ROLE_ADMIN"]);
  const denied = await adminApp.request("/maps/preview", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ url: "https://steamcommunity.com/sharedfiles/filedetails/?id=123456789" }),
  });
  assertEquals(denied.status, 403);
});

Deno.test("maps keep their external sources", async () => {
  const { app, headers } = await setup(["ROLE_USER", "ROLE_ADMIN"]);
  const game = await createGame(app, headers, "bo3");
  const created = await app.request("/admin/maps", {
    method: "POST",
    headers,
    body: JSON.stringify({
      gameId: game.id,
      slug: "leviathan",
      name: "Leviathan",
      type: "custom",
      status: "published",
      authors: ["JBird632"],
      sources: [{
        source: "steam",
        sourceUrl: "https://steamcommunity.com/sharedfiles/filedetails/?id=123456789",
        externalId: "123456789",
      }],
    }),
  });
  assertEquals(created.status, 201);
  const map = await created.json();
  assertEquals(map.sources[0].externalId, "123456789");
  assertEquals((await (await app.request(`/maps/${map.id}`)).json()).sources[0].externalId, "123456789");

  const archived = await app.request(`/admin/maps/${map.id}/status`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status: "archived" }),
  });
  assertEquals(archived.status, 200);
  assertEquals((await archived.json()).status, "archived");
});

Deno.test("map collection filters by partial name and exact game slug", async () => {
  const { app, headers } = await setup(["ROLE_USER", "ROLE_ADMIN"]);
  const bo3 = await createGame(app, headers, "bo3");
  const waw = await createGame(app, headers, "waw");
  await createMap(app, headers, bo3.id, "origins");
  await createMap(app, headers, waw.id, "origins-waw");

  const response = await app.request("/maps?name=rig&game=bo3");
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.entries.length, 1);
  assertEquals(body.entries[0].slug, "origins");
  assertEquals(body.entries[0].game.slug, "bo3");
  assertEquals(body.page, 0);
  assertEquals(body.pageSize, 50);
  assertEquals(body.hasMore, false);

  const catalogueSearch = await app.request("/maps?search=BO3");
  assertEquals(catalogueSearch.status, 200);
  assertEquals((await catalogueSearch.json()).entries[0].game.slug, "bo3");

  const gameSearch = await app.request("/games?search=BO3");
  assertEquals(gameSearch.status, 200);
  const gameSearchBody = await gameSearch.json();
  assertEquals(gameSearchBody.search, "BO3");
  assertEquals(gameSearchBody.hasMore, false);
  assertEquals(gameSearchBody.entries.map((entry: { slug: string }) => entry.slug), ["bo3"]);

  assertEquals((await app.request("/games?page=invalid")).status, 400);
  assertEquals((await app.request("/maps?page=-1")).status, 400);
});

Deno.test("category definitions can be assigned to a game or a map", async () => {
  const { app, headers } = await setup(["ROLE_USER", "ROLE_ADMIN"]);
  const game = await createGame(app, headers, "bo2");
  const map = await createMap(app, headers, game.id, "origins");
  const highRound = await createCategory(app, headers, {
    slug: "high-round",
    name: "High Round",
    scoreType: "round",
    rankingDirection: "higher_is_better",
    rules: { timer: "in-game" },
  });
  const classic = await createCategory(app, headers, {
    slug: "classic",
    name: "Classic",
    scoreType: "round",
    rankingDirection: "higher_is_better",
  });
  const firstRoom = await createCategory(app, headers, {
    slug: "first-room",
    name: "First Room",
    scoreType: "round",
    rankingDirection: "higher_is_better",
  });
  const globalAssignment = await createCategoryAssignment(app, headers, {
    categoryId: highRound.id,
    gameId: game.id,
  });
  await createCategoryAssignment(app, headers, {
    categoryId: highRound.id,
    gameId: game.id,
    mapId: map.id,
    specificRules: { powerups: "banned" },
  });
  await createCategoryAssignment(app, headers, { categoryId: classic.id, gameId: game.id });
  await createCategoryAssignment(app, headers, { categoryId: firstRoom.id, gameId: game.id, mapId: map.id });

  const response = await app.request(`/maps/${map.id}/categories`);
  assertEquals(response.status, 200);
  const listed = await response.json();
  const slugs = listed.map((category: { slug: string }) => category.slug);
  assertEquals(slugs.filter((slug: string) => slug === "high-round").length, 1);
  assert(slugs.includes("classic"));
  assert(slugs.includes("first-room"));
  const selected = listed.find((category: { slug: string }) => category.slug === "high-round");
  assertEquals(selected.globalRules, { timer: "in-game" });
  assertEquals(selected.specificRules, { powerups: "banned" });

  const assignmentsResponse = await app.request(
    `/admin/category-assignments?gameId=${game.id}&page=0`,
    { headers },
  );
  assertEquals(assignmentsResponse.status, 200);
  const assignments = await assignmentsResponse.json();
  assertEquals(assignments.pageSize, 50);
  assertEquals(assignments.entries.length, 4);
  assertEquals(assignments.entries[0].game.slug, "bo2");
  assert(
    assignments.entries.some((entry: { id: number; map: unknown }) =>
      entry.id === globalAssignment.id && entry.map === null
    ),
  );
  assertEquals((await app.request("/admin/category-assignments?mapId=nope", { headers })).status, 400);
});

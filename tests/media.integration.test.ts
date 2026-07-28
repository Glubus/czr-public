import { assert, assertEquals } from "@std/assert";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { clans, users } from "../src/db/schema.ts";
import { setup } from "./helpers.ts";

Deno.test("users and clan admins can host validated profile media", async () => {
  const { app, db, headers } = await setup(["ROLE_USER"]);
  const gif = new Uint8Array([
    0x47,
    0x49,
    0x46,
    0x38,
    0x39,
    0x61,
    0x01,
    0x00,
    0x01,
    0x00,
    0x80,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0xff,
    0xff,
    0xff,
    0x21,
    0xf9,
    0x04,
    0x01,
    0x00,
    0x00,
    0x00,
    0x00,
    0x2c,
    0x00,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x01,
    0x00,
    0x00,
    0x02,
    0x02,
    0x44,
    0x01,
    0x00,
    0x3b,
  ]);
  const mediaHeaders = new Headers(headers);
  mediaHeaders.set("content-type", "image/gif");

  const avatar = await app.request("/me/media/avatar", {
    method: "POST",
    headers: mediaHeaders,
    body: gif.slice().buffer as ArrayBuffer,
  });
  assertEquals(avatar.status, 201);
  const avatarBody = await avatar.json();
  assert(avatarBody.url.startsWith("/v1/media/users/"), JSON.stringify(avatarBody));
  const hostedAvatar = await app.request(avatarBody.url.replace(/^\/v1/, ""));
  assertEquals(hostedAvatar.status, 200);
  assertEquals(hostedAvatar.headers.get("content-type"), "image/gif");
  const optimizedGif = new Uint8Array(await hostedAvatar.arrayBuffer());
  assertEquals(new TextDecoder().decode(optimizedGif.slice(0, 6)), "GIF89a");

  const [user] = await db.select({ image: users.image }).from(users).where(eq(users.image, avatarBody.url));
  assertEquals(user?.image, avatarBody.url);

  const png = new Uint8Array(
    await sharp({
      create: { width: 8, height: 8, channels: 4, background: { r: 228, g: 87, b: 53, alpha: 1 } },
    }).png().toBuffer(),
  );
  const pngHeaders = new Headers(headers);
  pngHeaders.set("content-type", "image/png");
  const webpAvatar = await app.request("/me/media/avatar", {
    method: "POST",
    headers: pngHeaders,
    body: png.slice().buffer as ArrayBuffer,
  });
  assertEquals(webpAvatar.status, 201);
  const webpBody = await webpAvatar.json();
  assert(webpBody.url.endsWith(".webp"), JSON.stringify(webpBody));
  const hostedWebp = await app.request(webpBody.url.replace(/^\/v1/, ""));
  assertEquals(hostedWebp.headers.get("content-type"), "image/webp");

  const createdClan = await app.request("/clans", {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Media Clan", slug: `media-${crypto.randomUUID().slice(0, 12)}` }),
  });
  assertEquals(createdClan.status, 201);
  const clanBody = await createdClan.json();
  const logo = await app.request("/me/media/clan-logo", {
    method: "POST",
    headers: mediaHeaders,
    body: gif.slice().buffer as ArrayBuffer,
  });
  assertEquals(logo.status, 201);
  const logoBody = await logo.json();
  const [clan] = await db.select({ logoImage: clans.logoImage }).from(clans).where(eq(clans.id, clanBody.id));
  assertEquals(clan?.logoImage, logoBody.url);

  const invalid = await app.request("/me/media/avatar", {
    method: "POST",
    headers: mediaHeaders,
    body: new Uint8Array([1, 2, 3]).buffer,
  });
  assertEquals(invalid.status, 400);

  const declaredTooLargeHeaders = new Headers(mediaHeaders);
  declaredTooLargeHeaders.set("content-length", String(4 * 1024 * 1024 + 1));
  const declaredTooLarge = await app.request("/me/media/avatar", {
    method: "POST",
    headers: declaredTooLargeHeaders,
    body: gif.slice().buffer as ArrayBuffer,
  });
  assertEquals(declaredTooLarge.status, 413);
  assertEquals((await declaredTooLarge.json()).code, "payload_too_large");

  const streamedTooLarge = await app.request("/me/media/avatar", {
    method: "POST",
    headers: mediaHeaders,
    body: new Uint8Array(4 * 1024 * 1024 + 1),
  });
  assertEquals(streamedTooLarge.status, 413);

  const rateLimited = await app.request("/me/media/avatar", {
    method: "POST",
    headers: mediaHeaders,
    body: gif.slice().buffer as ArrayBuffer,
  });
  assertEquals(rateLimited.status, 429);
});

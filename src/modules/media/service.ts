import { eq } from "drizzle-orm";
import { Effect } from "effect";
import type { Database } from "../../db/client.ts";
import { clanMembers, clans, users } from "../../db/schema.ts";
import type { BlobStore } from "../../infra/blob-store.ts";
import { NotFoundError, ValidationError } from "../shared/errors.ts";
import { optimizeMedia } from "./optimizer.ts";

export type MediaKind = "avatar" | "profile-background" | "clan-logo" | "clan-background";

export function maximumMediaBytes(kind: MediaKind) {
  return kind === "avatar" || kind === "clan-logo" ? 4 * 1024 * 1024 : 10 * 1024 * 1024;
}

const formats = {
  "image/jpeg": { extension: "jpg", signatures: [[0xff, 0xd8, 0xff]] },
  "image/png": { extension: "png", signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  "image/gif": {
    extension: "gif",
    signatures: [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  },
  "image/webp": { extension: "webp", signatures: [[0x52, 0x49, 0x46, 0x46]] },
} as const;

export function uploadMedia(
  db: Database,
  blobStore: BlobStore,
  userId: string,
  kind: MediaKind,
  contentType: string,
  bytes: Uint8Array,
) {
  return Effect.tryPromise({
    try: async () => {
      const format = formats[contentType as keyof typeof formats];
      if (!format || !matchesSignature(bytes, contentType, format.signatures)) {
        throw new ValidationError("media must be a valid JPEG, PNG, WebP, or GIF image");
      }
      const maximum = maximumMediaBytes(kind);
      if (!bytes.length || bytes.length > maximum) {
        throw new ValidationError(`media exceeds the ${maximum / 1024 / 1024} MB limit`);
      }

      let optimized;
      try {
        optimized = await optimizeMedia(kind, contentType, bytes);
      } catch {
        throw new ValidationError("media could not be decoded as a safe image");
      }
      if (!optimized.bytes.length || optimized.bytes.length > maximum) {
        throw new ValidationError(`optimized media exceeds the ${maximum / 1024 / 1024} MB limit`);
      }

      if (kind === "avatar" || kind === "profile-background") {
        const folder = `users/${userId}/${kind}`;
        const key = `${folder}/image-${crypto.randomUUID()}.${optimized.extension}`;
        const [current] = await db.select({
          image: users.image,
          backgroundImage: users.backgroundImage,
        }).from(users).where(eq(users.id, userId)).limit(1);
        if (!current) throw new NotFoundError("user not found");
        await blobStore.put(key, optimized.bytes);
        const url = `/v1/media/${key}`;
        const [updated] = await db.update(users).set(
          kind === "avatar"
            ? { image: url, updatedAt: new Date() }
            : { backgroundImage: url, updatedAt: new Date() },
        ).where(eq(users.id, userId)).returning({
          image: users.image,
          backgroundImage: users.backgroundImage,
        });
        if (!updated) throw new NotFoundError("user not found");
        await deletePreviousMedia(
          blobStore,
          kind === "avatar" ? current.image : current.backgroundImage,
          key,
        );
        return { kind, url, ...updated };
      }

      const [membership] = await db.select({ clanId: clanMembers.clanId, role: clanMembers.role })
        .from(clanMembers).where(eq(clanMembers.userId, userId)).limit(1);
      if (!membership) throw new NotFoundError("clan membership not found");
      if (membership.role !== "owner" && membership.role !== "admin") {
        throw new ValidationError("only clan owners and admins can change clan media");
      }
      const folder = `clans/${membership.clanId}/${kind}`;
      const key = `${folder}/image-${crypto.randomUUID()}.${optimized.extension}`;
      const [current] = await db.select({
        logoImage: clans.logoImage,
        backgroundImage: clans.backgroundImage,
      }).from(clans).where(eq(clans.id, membership.clanId)).limit(1);
      if (!current) throw new NotFoundError("clan not found");
      await blobStore.put(key, optimized.bytes);
      const url = `/v1/media/${key}`;
      const [updated] = await db.update(clans).set(
        kind === "clan-logo"
          ? { logoImage: url, updatedAt: new Date() }
          : { backgroundImage: url, updatedAt: new Date() },
      ).where(eq(clans.id, membership.clanId)).returning({
        logoImage: clans.logoImage,
        backgroundImage: clans.backgroundImage,
      });
      if (!updated) throw new NotFoundError("clan not found");
      await deletePreviousMedia(
        blobStore,
        kind === "clan-logo" ? current.logoImage : current.backgroundImage,
        key,
      );
      return { kind, url, ...updated };
    },
    catch: (error) => error,
  });
}

async function deletePreviousMedia(blobStore: BlobStore, url: string | null, currentKey: string) {
  const prefix = "/v1/media/";
  if (!url?.startsWith(prefix)) return;
  const key = url.slice(prefix.length);
  if (key && key !== currentKey) await blobStore.delete(key);
}

export function parseMediaKind(value: string): MediaKind {
  if (["avatar", "profile-background", "clan-logo", "clan-background"].includes(value)) {
    return value as MediaKind;
  }
  throw new ValidationError("unknown media kind");
}

export function mediaContentType(key: string) {
  if (key.endsWith(".jpg")) return "image/jpeg";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".gif")) return "image/gif";
  if (key.endsWith(".webp")) return "image/webp";
  return null;
}

function matchesSignature(
  bytes: Uint8Array,
  contentType: string,
  signatures: readonly (readonly number[])[],
) {
  const matches = signatures.some((signature) => signature.every((byte, index) => bytes[index] === byte));
  if (!matches) return false;
  if (contentType !== "image/webp") return true;
  return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
}

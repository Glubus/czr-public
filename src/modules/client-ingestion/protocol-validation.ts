import { ValidationError } from "../shared/errors.ts";

export const MAX_COMPRESSED_CHUNK_BYTES = 8 * 1024 * 1024;
export const MAX_UNCOMPRESSED_CHUNK_BYTES = 32 * 1024 * 1024;
export const MAX_CHUNK_GAME_DURATION_MS = 35 * 60 * 1_000;

export function validateEventPayload(bytes: Uint8Array) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ValidationError("uncompressed chunk must contain valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || !("events" in parsed) || !Array.isArray(parsed.events)) {
    throw new ValidationError("events-v1 chunk must contain an events array");
  }
  if (parsed.events.length > 100_000) {
    throw new ValidationError("one chunk cannot contain more than 100000 events");
  }
  return parsed.events.length;
}

export async function decompressGzip(compressed: Uint8Array) {
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = new Blob([Uint8Array.from(compressed).buffer]).stream().pipeThrough(
      new DecompressionStream("gzip"),
    );
  } catch {
    throw new ValidationError("chunk is not valid gzip data");
  }
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_UNCOMPRESSED_CHUNK_BYTES) {
        await reader.cancel();
        throw new ValidationError("uncompressed chunk exceeds 32 MiB");
      }
      parts.push(value);
    }
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError("chunk is not valid gzip data");
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

export function assertUuid(value: string, field: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ValidationError(`${field} must be a UUID`);
  }
}

export function assertRunToken(value: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new ValidationError("runToken must be 32-byte base64url");
}

export function assertShortIdentifier(value: string, field: string) {
  if (!/^[a-zA-Z0-9._-]{1,100}$/.test(value)) {
    throw new ValidationError(`${field} must contain 1 to 100 safe identifier characters`);
  }
}

export function assertPositiveInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ValidationError(`${field} must be a positive integer`);
  }
}

export function assertNonNegativeInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ValidationError(`${field} must be a non-negative integer`);
  }
}

export function assertSha256(value: string, field: string) {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new ValidationError(`${field} must be a SHA-256 hex digest`);
}

export function assertRecentDate(value: string, field: string, pastWindowMs: number) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new ValidationError(`${field} must be an ISO date-time`);
  if (parsed > Date.now() + 10 * 60 * 1_000 || parsed < Date.now() - pastWindowMs) {
    throw new ValidationError(`${field} is outside the accepted clock window`);
  }
}

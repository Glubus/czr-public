import { ValidationError } from "../shared/errors.ts";

export function withoutSignature<A extends { signature: string }>(value: A): Omit<A, "signature"> {
  const { signature: _signature, ...unsigned } = value;
  return unsigned;
}

export function withoutRunToken<A extends { runToken: string }>(value: A): Omit<A, "runToken"> {
  const { runToken: _runToken, ...safe } = value;
  return safe;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${
    Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`
    ).join(",")
  }}`;
}

export async function assertSignature(publicKeySpki: string, signature: string, message: string) {
  try {
    const key = await importPublicKey(publicKeySpki);
    const valid = await crypto.subtle.verify(
      "Ed25519",
      key,
      decodeBase64(signature),
      new TextEncoder().encode(message),
    );
    if (!valid) throw new ValidationError("invalid client signature");
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError("invalid client signature");
  }
}

export async function importPublicKey(value: string) {
  try {
    return await crypto.subtle.importKey("spki", decodeBase64(value), "Ed25519", false, ["verify"]);
  } catch {
    throw new ValidationError("publicKeySpki must be a base64 Ed25519 SPKI key");
  }
}

export function decodeBase64(value: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new ValidationError("value must be canonical base64");
  }
  try {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  } catch {
    throw new ValidationError("value must be canonical base64");
  }
}

export function randomBase64Url(size: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export async function sha256Hex(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

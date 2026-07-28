import type { MiddlewareHandler } from "hono";
import type { AuthEnv } from "../auth/authorization.ts";

export function requireDocsToken(expectedToken: string | undefined): MiddlewareHandler<AuthEnv> {
  return async (context, next) => {
    if (!expectedToken) {
      return context.notFound();
    }

    const credentials = parseBasicCredentials(context.req.header("authorization"));
    if (
      !credentials ||
      credentials.username !== "docs" ||
      !await secureEqual(credentials.password, expectedToken)
    ) {
      context.header("www-authenticate", 'Basic realm="ZWR internal API documentation", charset="UTF-8"');
      return context.text("Documentation token required", 401);
    }

    await next();
  };
}

function parseBasicCredentials(value: string | undefined) {
  if (!value?.startsWith("Basic ")) return undefined;
  try {
    const decoded = atob(value.slice("Basic ".length));
    const separator = decoded.indexOf(":");
    if (separator < 0) return undefined;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return undefined;
  }
}

async function secureEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index++) {
    difference |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return difference === 0;
}

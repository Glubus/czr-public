import type { Context } from "hono";
import type { Effect } from "effect";
import type { AuthEnv } from "../auth/authorization.ts";

/** Keeps Hono handlers as thin adapters around an Effect program. */
export type HttpEffectRunner = <A, E>(
  context: Context<AuthEnv>,
  program: Effect.Effect<A, E>,
  onSuccess: (value: A) => Response,
) => Promise<Response>;

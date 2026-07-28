import type { Context, Env } from "hono";

type Problem = {
  status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500;
  code: string;
  detail: string;
  details?: ReadonlyArray<{ path: string; message: string }>;
};

const titles: Record<Problem["status"], string> = {
  400: "Validation failed",
  401: "Authentication required",
  403: "Permission denied",
  404: "Resource not found",
  409: "Conflict",
  413: "Payload too large",
  429: "Rate limit exceeded",
  500: "Internal server error",
};

/** Converts the application's tagged errors into the public RFC 9457 contract. */
export function problemResponse<E extends Env>(context: Context<E>, problem: Problem): Response {
  return context.json(
    {
      type: `https://api.zwr.dev/problems/${problem.code}`,
      title: titles[problem.status],
      status: problem.status,
      detail: problem.detail,
      code: problem.code,
      ...(problem.details === undefined ? {} : { details: problem.details }),
    },
    problem.status,
    { "content-type": "application/problem+json" },
  );
}

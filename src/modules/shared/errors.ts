import { Data } from "effect";

/** A recoverable input or business-rule failure. */
export class ValidationError extends Data.TaggedError("ValidationError")<{ message: string }> {
  readonly code = "validation_failed";

  constructor(message: string) {
    super({ message });
  }
}

/** An operation would violate an existing domain invariant. */
export class ConflictError extends Data.TaggedError("ConflictError")<{ message: string }> {
  readonly code = "conflict";

  constructor(message: string) {
    super({ message });
  }
}

/** A requested aggregate does not exist. */
export class NotFoundError extends Data.TaggedError("NotFoundError")<{ message: string }> {
  readonly code = "not_found";

  constructor(message: string) {
    super({ message });
  }
}

/** A domain-specific creation limit; existing resources remain usable. */
export class RateLimitError extends Data.TaggedError("RateLimitError")<{
  message: string;
  retryAfterSeconds: number;
}> {
  readonly code = "rate_limited";

  constructor(message: string, retryAfterSeconds: number) {
    super({ message, retryAfterSeconds });
  }
}

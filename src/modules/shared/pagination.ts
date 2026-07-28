import { ValidationError } from "./errors.ts";

export function parsePage(value?: string) {
  if (value === undefined) return 0;
  if (!/^[0-9]+$/.test(value)) throw new ValidationError("page must be a non-negative integer");
  const page = Number(value);
  if (!Number.isSafeInteger(page)) throw new ValidationError("page must be a non-negative integer");
  return page;
}

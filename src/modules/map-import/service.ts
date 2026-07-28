import { Data, Effect, Schema } from "effect";

const PreviewPayload = Schema.Struct({
  url: Schema.String.pipe(Schema.minLength(1)),
});

export type MapImportPreview = {
  source: "steam" | "ugx" | "manual" | "unknown";
  sourceUrl: string;
  externalId: string | null;
  name: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  authors: string[];
  type: "custom";
  game: {
    slug: string | null;
    confidence: "high" | "medium" | "low";
  };
  confidence: Record<string, "high" | "medium" | "low">;
  warnings: string[];
};

export class ImportValidationError extends Data.TaggedError("ImportValidationError")<{ message: string }> {
  readonly code = "validation_failed";

  constructor(message: string) {
    super({ message });
  }
}

export function previewMapImport(payload: unknown) {
  return Schema.decodeUnknown(PreviewPayload)(payload).pipe(
    Effect.mapError((error) => new ImportValidationError(String(error))),
    Effect.map(({ url }) => buildPreview(url)),
  );
}

function buildPreview(sourceUrl: string): MapImportPreview {
  const parsed = new URL(sourceUrl);

  if (parsed.hostname.includes("steamcommunity.com")) {
    return {
      source: "steam",
      sourceUrl,
      externalId: parsed.searchParams.get("id"),
      name: null,
      description: null,
      thumbnailUrl: null,
      authors: [],
      type: "custom",
      game: {
        slug: null,
        confidence: "low",
      },
      confidence: {
        externalId: parsed.searchParams.has("id") ? "high" : "low",
        game: "low",
      },
      warnings: ["Steam app id could not be resolved from this URL alone"],
    };
  }

  if (parsed.hostname.includes("ugx-mods.com")) {
    return {
      source: "ugx",
      sourceUrl,
      externalId: lastNumericPathSegment(parsed.pathname),
      name: titleFromSlug(parsed.pathname),
      description: null,
      thumbnailUrl: null,
      authors: [],
      type: "custom",
      game: {
        slug: null,
        confidence: "low",
      },
      confidence: {
        name: "low",
        game: "low",
      },
      warnings: ["UGX import uses scraping and must be reviewed by an admin"],
    };
  }

  return {
    source: "unknown",
    sourceUrl,
    externalId: null,
    name: null,
    description: null,
    thumbnailUrl: null,
    authors: [],
    type: "custom",
    game: {
      slug: null,
      confidence: "low",
    },
    confidence: {},
    warnings: ["Unsupported map source; admin must fill the map manually"],
  };
}

function lastNumericPathSegment(pathname: string) {
  return pathname
    .split("/")
    .filter(Boolean)
    .reverse()
    .find((segment) => /^\d+$/.test(segment)) ?? null;
}

function titleFromSlug(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const slug = segments.find((segment) => /^[a-z0-9-]+$/i.test(segment) && !/^\d+$/.test(segment));

  if (!slug) {
    return null;
  }

  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

import { ValidationError } from "../shared/errors.ts";

export function assertValidSubmissionValues(scoreValue: number, runDurationMs: number | null | undefined) {
  if (!Number.isSafeInteger(scoreValue) || scoreValue <= 0) {
    throw new ValidationError("scoreValue must be a positive integer");
  }
  if (
    runDurationMs !== null && runDurationMs !== undefined &&
    (!Number.isSafeInteger(runDurationMs) || runDurationMs <= 0)
  ) {
    throw new ValidationError("runDurationMs must be a positive integer when provided");
  }
}

export function validateProofs(
  proofs:
    | readonly {
      type: string;
      sourceUrl?: string | null;
      storageKey?: string | null;
      sha256?: string | null;
      formatVersion?: number;
    }[]
    | undefined,
) {
  if (!proofs) return;
  if (proofs.some((proof) => !proof.sourceUrl && !proof.storageKey)) {
    throw new ValidationError("each proof needs a sourceUrl or storageKey");
  }
  if (
    proofs.some((proof) => !Number.isSafeInteger(proof.formatVersion ?? 1) || (proof.formatVersion ?? 1) < 1)
  ) {
    throw new ValidationError("proof formatVersion must be a positive integer");
  }
  if (
    proofs.some((proof) =>
      ["demo", "input_log", "event_log", "hash_manifest"].includes(proof.type) &&
      !/^[a-f0-9]{64}$/i.test(proof.sha256 ?? "")
    )
  ) {
    throw new ValidationError("verifiable proof artifacts require a sha256 hash");
  }
}

export function competitorKeyFor(participantUserIds: ReadonlyArray<string>) {
  return `team:${[...participantUserIds].sort().join(":")}`;
}

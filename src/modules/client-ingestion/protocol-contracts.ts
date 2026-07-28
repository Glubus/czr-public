import { Schema } from "effect";

export const RegisterInstallation = Schema.Struct({
  name: Schema.String,
  publicKeySpki: Schema.String,
});
export const RegisterVersion = Schema.Struct({
  clientName: Schema.String,
  version: Schema.String,
  protocolVersion: Schema.Number,
  releaseNotes: Schema.optional(Schema.NullOr(Schema.String)),
});
export const UpdateVersion = Schema.Struct({ status: Schema.Literal("allowed", "revoked") });
export const StartRunUnsigned = Schema.Struct({
  runId: Schema.String,
  runToken: Schema.String,
  installationId: Schema.String,
  clientName: Schema.String,
  clientVersion: Schema.String,
  protocolVersion: Schema.Number,
  gameId: Schema.Number,
  mapId: Schema.Number,
  platform: Schema.optional(Schema.NullOr(Schema.String)),
  gameVersion: Schema.optional(Schema.NullOr(Schema.String)),
  mapVersion: Schema.optional(Schema.NullOr(Schema.String)),
  modId: Schema.optional(Schema.NullOr(Schema.Number)),
  modVersion: Schema.optional(Schema.NullOr(Schema.String)),
  participantUserIds: Schema.optional(Schema.Array(Schema.String)),
});
export const StartRun = Schema.Struct({ ...StartRunUnsigned.fields, signature: Schema.String });
export const HeartbeatUnsigned = Schema.Struct({
  runToken: Schema.String,
  sequence: Schema.Number,
  gameElapsedMs: Schema.Number,
  round: Schema.optional(Schema.NullOr(Schema.Number)),
  observedAt: Schema.String,
});
export const Heartbeat = Schema.Struct({ ...HeartbeatUnsigned.fields, signature: Schema.String });
export const ChunkUnsigned = Schema.Struct({
  runToken: Schema.String,
  sequence: Schema.Number,
  startElapsedMs: Schema.Number,
  endElapsedMs: Schema.Number,
  previousChunkSha256: Schema.optional(Schema.NullOr(Schema.String)),
  compression: Schema.Literal("gzip"),
  payloadFormat: Schema.Literal("events-v1"),
  compressedSha256: Schema.String,
  uncompressedSha256: Schema.String,
  compressedDataBase64: Schema.String,
});
export const Chunk = Schema.Struct({ ...ChunkUnsigned.fields, signature: Schema.String });
export const SubmissionEntry = Schema.Struct({
  categoryAssignmentId: Schema.Number,
  scoreValue: Schema.Number,
  runDurationMs: Schema.optional(Schema.NullOr(Schema.Number)),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});
export const FinalState = Schema.Struct({
  gameElapsedMs: Schema.Number,
  round: Schema.optional(Schema.NullOr(Schema.Number)),
  endedAt: Schema.String,
});
export const FinalizeUnsigned = Schema.Struct({
  runToken: Schema.String,
  interrupted: Schema.Boolean,
  finalState: FinalState,
  entries: Schema.Array(SubmissionEntry),
  proofUrl: Schema.optional(Schema.NullOr(Schema.String)),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});
export const FinalizeRun = Schema.Struct({ ...FinalizeUnsigned.fields, signature: Schema.String });
export const RecoverRun = Schema.Struct({ signature: Schema.String });
export const AbandonRun = Schema.Struct({ runToken: Schema.String, signature: Schema.String });

export const PROTOCOL_VERSION = 1;
export const RUN_START_LIMIT_PER_HOUR = 180;
export const HEARTBEAT_GAP_MS = 90_000;

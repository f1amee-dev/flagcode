import { Schema } from "effect";
import { FindingId, IsoDateTime, NonNegativeInt, SwarmId, ThreadId } from "./baseSchemas";

export const SwarmFindingKind = Schema.Literals([
  "discovery",
  "hypothesis",
  "progress",
  "error",
  "flag",
]);
export type SwarmFindingKind = typeof SwarmFindingKind.Type;

export const SwarmFinding = Schema.Struct({
  id: FindingId,
  swarmId: SwarmId,
  threadId: ThreadId,
  kind: SwarmFindingKind,
  summary: Schema.String,
  detail: Schema.optional(Schema.String),
  sequence: NonNegativeInt,
  createdAt: IsoDateTime,
});
export type SwarmFinding = typeof SwarmFinding.Type;

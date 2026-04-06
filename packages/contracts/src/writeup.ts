import { Schema } from "effect";
import { TrimmedNonEmptyString } from "./baseSchemas";
import { ModelSelection } from "./orchestration";

export const WriteupGenerateInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  threadTitle: Schema.String,
  ctfCategory: Schema.NullOr(Schema.String),
  messages: Schema.Array(
    Schema.Struct({
      role: Schema.String,
      text: Schema.String,
    }),
  ),
  modelSelection: ModelSelection,
});
export type WriteupGenerateInput = typeof WriteupGenerateInput.Type;

export const WriteupGenerateResult = Schema.Struct({
  relativePath: TrimmedNonEmptyString,
  writeup: Schema.String,
});
export type WriteupGenerateResult = typeof WriteupGenerateResult.Type;

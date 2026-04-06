/**
 * Shared prompt builders for text generation providers.
 *
 * Extracts the prompt construction logic that is identical across
 * Codex, Claude, and any future CLI-based text generation backends.
 *
 * @module textGenerationPrompts
 */
import { Schema } from "effect";
import type { ChatAttachment } from "@flagcode/contracts";

import { limitSection } from "./Utils.ts";

// ---------------------------------------------------------------------------
// Commit message
// ---------------------------------------------------------------------------

export interface CommitMessagePromptInput {
  branch: string | null;
  stagedSummary: string;
  stagedPatch: string;
  includeBranch: boolean;
}

export function buildCommitMessagePrompt(input: CommitMessagePromptInput) {
  const wantsBranch = input.includeBranch;

  const prompt = [
    "You write concise git commit messages.",
    wantsBranch
      ? "Return a JSON object with keys: subject, body, branch."
      : "Return a JSON object with keys: subject, body.",
    "Rules:",
    "- subject must be imperative, <= 72 chars, and no trailing period",
    "- body can be empty string or short bullet points",
    ...(wantsBranch
      ? ["- branch must be a short semantic git branch fragment for this change"]
      : []),
    "- capture the primary user-visible or developer-visible change",
    "",
    `Branch: ${input.branch ?? "(detached)"}`,
    "",
    "Staged files:",
    limitSection(input.stagedSummary, 6_000),
    "",
    "Staged patch:",
    limitSection(input.stagedPatch, 40_000),
  ].join("\n");

  if (wantsBranch) {
    return {
      prompt,
      outputSchema: Schema.Struct({
        subject: Schema.String,
        body: Schema.String,
        branch: Schema.String,
      }),
    };
  }

  return {
    prompt,
    outputSchema: Schema.Struct({
      subject: Schema.String,
      body: Schema.String,
    }),
  };
}

// ---------------------------------------------------------------------------
// PR content
// ---------------------------------------------------------------------------

export interface PrContentPromptInput {
  baseBranch: string;
  headBranch: string;
  commitSummary: string;
  diffSummary: string;
  diffPatch: string;
}

export function buildPrContentPrompt(input: PrContentPromptInput) {
  const prompt = [
    "You write GitHub pull request content.",
    "Return a JSON object with keys: title, body.",
    "Rules:",
    "- title should be concise and specific",
    "- body must be markdown and include headings '## Summary' and '## Testing'",
    "- under Summary, provide short bullet points",
    "- under Testing, include bullet points with concrete checks or 'Not run' where appropriate",
    "",
    `Base branch: ${input.baseBranch}`,
    `Head branch: ${input.headBranch}`,
    "",
    "Commits:",
    limitSection(input.commitSummary, 12_000),
    "",
    "Diff stat:",
    limitSection(input.diffSummary, 12_000),
    "",
    "Diff patch:",
    limitSection(input.diffPatch, 40_000),
  ].join("\n");

  const outputSchema = Schema.Struct({
    title: Schema.String,
    body: Schema.String,
  });

  return { prompt, outputSchema };
}

// ---------------------------------------------------------------------------
// Branch name
// ---------------------------------------------------------------------------

export interface BranchNamePromptInput {
  message: string;
  attachments?: ReadonlyArray<ChatAttachment> | undefined;
}

interface PromptFromMessageInput {
  instruction: string;
  responseShape: string;
  rules: ReadonlyArray<string>;
  message: string;
  attachments?: ReadonlyArray<ChatAttachment> | undefined;
}

function buildPromptFromMessage(input: PromptFromMessageInput): string {
  const attachmentLines = (input.attachments ?? []).map(
    (attachment) => `- ${attachment.name} (${attachment.mimeType}, ${attachment.sizeBytes} bytes)`,
  );

  const promptSections = [
    input.instruction,
    input.responseShape,
    "Rules:",
    ...input.rules.map((rule) => `- ${rule}`),
    "",
    "User message:",
    limitSection(input.message, 8_000),
  ];
  if (attachmentLines.length > 0) {
    promptSections.push(
      "",
      "Attachment metadata:",
      limitSection(attachmentLines.join("\n"), 4_000),
    );
  }

  return promptSections.join("\n");
}

export function buildBranchNamePrompt(input: BranchNamePromptInput) {
  const prompt = buildPromptFromMessage({
    instruction: "You generate concise git branch names.",
    responseShape: "Return a JSON object with key: branch.",
    rules: [
      "Branch should describe the requested work from the user message.",
      "Keep it short and specific (2-6 words).",
      "Use plain words only, no issue prefixes and no punctuation-heavy text.",
      "If images are attached, use them as primary context for visual/UI issues.",
    ],
    message: input.message,
    attachments: input.attachments,
  });
  const outputSchema = Schema.Struct({
    branch: Schema.String,
  });

  return { prompt, outputSchema };
}

// ---------------------------------------------------------------------------
// Thread title
// ---------------------------------------------------------------------------

export interface ThreadTitlePromptInput {
  message: string;
  attachments?: ReadonlyArray<ChatAttachment> | undefined;
}

// ---------------------------------------------------------------------------
// CTF writeup
// ---------------------------------------------------------------------------

export interface WriteupPromptInput {
  threadTitle: string;
  ctfCategory: string | null;
  messages: ReadonlyArray<{ role: string; text: string }>;
}

export function buildWriteupPrompt(input: WriteupPromptInput) {
  const conversationLines = input.messages.map((m) => `[${m.role}]: ${m.text}`).join("\n\n");

  const prompt = [
    "You write CTF challenge writeups.",
    "Return a JSON object with key: writeup. The value is a markdown string.",
    "Rules:",
    "- Write as if a human wrote it. Use simple, plain language.",
    "- No em dashes. No emojis. No complex showcase patterns.",
    "- Do not use excessive bullet points. Prefer paragraphs and short code blocks.",
    "- Structure: brief intro of the challenge, the approach taken step by step, key discoveries, and the flag.",
    "- Make it replicable: someone reading it should be able to follow the same steps to capture the flag.",
    "- Keep it concise but thorough enough to be useful.",
    "",
    `Challenge title: ${input.threadTitle}`,
    ...(input.ctfCategory ? [`Category: ${input.ctfCategory}`] : []),
    "",
    "Conversation:",
    limitSection(conversationLines, 60_000),
  ].join("\n");

  const outputSchema = Schema.Struct({
    writeup: Schema.String,
  });

  return { prompt, outputSchema };
}

export function buildThreadTitlePrompt(input: ThreadTitlePromptInput) {
  const prompt = buildPromptFromMessage({
    instruction: "You write concise thread titles for coding conversations.",
    responseShape: "Return a JSON object with key: title.",
    rules: [
      "Title should summarize the user's request, not restate it verbatim.",
      "Keep it short and specific (3-8 words).",
      "Avoid quotes, filler, prefixes, and trailing punctuation.",
      "If images are attached, use them as primary context for visual/UI issues.",
    ],
    message: input.message,
    attachments: input.attachments,
  });
  const outputSchema = Schema.Struct({
    title: Schema.String,
  });

  return { prompt, outputSchema };
}

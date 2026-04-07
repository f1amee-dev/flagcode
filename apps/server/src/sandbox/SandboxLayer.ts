import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { ProviderSandboxMode, ThreadId } from "@flagcode/contracts";
import { Effect } from "effect";

import type { SandboxHandle } from "./SandboxHandles.ts";

const DOCKER_IMAGE = "flagcode/sandbox:latest";
const HELPER_SCRIPT_NAME = "sb";
const HELPER_SCRIPT_NAME_WIN = "sb.cmd";

export interface StartContainerInput {
  readonly threadId: ThreadId;
  readonly cwd: string;
  readonly sandboxMode: ProviderSandboxMode;
}

function dockerRun(input: StartContainerInput): string {
  const volumeFlag = buildVolumeFlag(input);
  const result = execFileSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      ...volumeFlag,
      "--label",
      `flagcode.threadId=${String(input.threadId)}`,
      DOCKER_IMAGE,
    ],
    { encoding: "utf-8", timeout: 30_000 },
  );
  return result.trim();
}

function dockerStop(containerId: string): void {
  try {
    execFileSync("docker", ["stop", containerId], {
      encoding: "utf-8",
      timeout: 15_000,
      stdio: "ignore",
    });
  } catch {}
}

function buildVolumeFlag(input: StartContainerInput): readonly string[] {
  const target = "/workspace";
  switch (input.sandboxMode) {
    case "read-only":
      return ["-v", `${input.cwd}:${target}:ro`];
    case "workspace-write":
      return ["-v", `${input.cwd}:${target}`];
    case "danger-full-access":
      return ["-v", `${input.cwd}:${target}`, "--privileged"];
  }
}

function writeHelperScripts(cwd: string, containerId: string): void {
  const unixScript = `#!/usr/bin/env sh\nexec docker exec -it ${containerId} /bin/sh "$@"\n`;
  const winScript = `@echo off\r\ndocker exec -it ${containerId} /bin/sh %*\r\n`;
  fs.writeFileSync(path.join(cwd, HELPER_SCRIPT_NAME), unixScript, { mode: 0o755 });
  fs.writeFileSync(path.join(cwd, HELPER_SCRIPT_NAME_WIN), winScript);
}

function removeHelperScripts(cwd: string): void {
  for (const name of [HELPER_SCRIPT_NAME, HELPER_SCRIPT_NAME_WIN]) {
    try {
      fs.unlinkSync(path.join(cwd, name));
    } catch {}
  }
}

export function startContainer(
  input: StartContainerInput,
): Effect.Effect<SandboxHandle, SandboxContainerError> {
  return Effect.gen(function* () {
    const containerId = yield* Effect.try({
      try: () => dockerRun(input),
      catch: (cause) =>
        new SandboxContainerError({ phase: "docker-run", threadId: input.threadId, cause }),
    });

    yield* Effect.try({
      try: () => writeHelperScripts(input.cwd, containerId),
      catch: (cause) =>
        new SandboxContainerError({
          phase: "write-helper-scripts",
          threadId: input.threadId,
          containerId,
          cause,
        }),
    }).pipe(Effect.tapError(() => Effect.sync(() => dockerStop(containerId))));

    const handle: SandboxHandle = {
      threadId: input.threadId,
      containerId,
      stop: Effect.sync(() => {
        dockerStop(containerId);
        removeHelperScripts(input.cwd);
      }),
    };

    yield* Effect.logInfo("Sandbox container started", {
      threadId: input.threadId,
      containerId,
      sandboxMode: input.sandboxMode,
    });

    return handle;
  });
}

export class SandboxContainerError extends Error {
  readonly _tag = "SandboxContainerError";
  readonly phase: string;
  readonly threadId: ThreadId;
  readonly containerId: string | undefined;

  constructor(opts: { phase: string; threadId: ThreadId; containerId?: string; cause?: unknown }) {
    const detail =
      opts.cause instanceof Error ? opts.cause.message : String(opts.cause ?? "unknown");
    super(
      `Sandbox container error during '${opts.phase}' for thread '${String(opts.threadId)}': ${detail}`,
    );
    this.name = "SandboxContainerError";
    this.phase = opts.phase;
    this.threadId = opts.threadId;
    this.containerId = opts.containerId;
    if (opts.cause instanceof Error) {
      this.cause = opts.cause;
    }
  }
}

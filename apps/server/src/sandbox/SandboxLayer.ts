/**
 * SandboxLayer - Docker CTF sandbox layer implementations.
 *
 * SandboxLayerLive: real Docker implementation using node:child_process.
 * SandboxLayerNoop: no-op implementation for environments without Docker.
 *
 * @module SandboxLayer
 */
import { execFileSync, execFile as execFileCb, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import type { ProviderSandboxMode, ThreadId } from "@flagcode/contracts";
import { Cause, Effect, Layer, Stream, Queue } from "effect";

import {
  SANDBOX_IMAGE_NAME,
  SANDBOX_IMAGE_TAG,
  resolveDockerBridgeHost,
} from "@flagcode/shared/sandbox";
import {
  SandboxError,
  SandboxService,
  type SandboxHandle,
  type SandboxInstallProgress,
  type SandboxServiceShape,
} from "./SandboxService.ts";
import type { SandboxHandle as ProviderSandboxHandle } from "./SandboxHandles.ts";

const execFile = promisify(execFileCb);

const SANDBOX_IMAGE_REF = `${SANDBOX_IMAGE_NAME}:${SANDBOX_IMAGE_TAG}`;
const DOCKER_IMAGE = "flagcode/sandbox:latest";
const HELPER_SCRIPT_NAME = "sb";
const HELPER_SCRIPT_NAME_WIN = "sb.cmd";

// This file lives at apps/server/src/sandbox/SandboxLayer.ts
// Going up 4 levels reaches the monorepo root where sandbox/Dockerfile lives.
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../..");

// ---------------------------------------------------------------------------
// Provider-level sandbox (used by ClaudeAdapter / CodexAdapter)
// ---------------------------------------------------------------------------

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
): Effect.Effect<ProviderSandboxHandle, SandboxContainerError> {
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

    const handle: ProviderSandboxHandle = {
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

// ---------------------------------------------------------------------------
// CTF Sandbox Service Layer (SandboxLayerLive / SandboxLayerNoop)
// ---------------------------------------------------------------------------

async function isDockerAvailableImpl(): Promise<boolean> {
  try {
    await execFile("docker", ["info"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

async function isImageInstalledImpl(): Promise<boolean> {
  try {
    await execFile("docker", ["image", "inspect", SANDBOX_IMAGE_REF], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

function installImageStream(): Stream.Stream<SandboxInstallProgress, SandboxError> {
  return Stream.callback<SandboxInstallProgress, SandboxError>((queue) => {
    const child = spawn("docker", ["pull", SANDBOX_IMAGE_REF], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let lastImageId = "";
    // Accumulate stderr separately so we can report it on failure, but
    // also forward it as progress lines (docker pull writes progress to stderr
    // when stdout is not a TTY).
    let stderrFull = "";
    let stdoutBuf = "";
    let stderrBuf = "";

    const offerLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Extract image digest for the "complete" event
      if (trimmed.startsWith("Digest:") && trimmed.includes("sha256:")) {
        lastImageId = trimmed.split("sha256:")[1]?.split(/\s/)[0] ?? "";
      }

      // Skip purely informational lines that carry no useful progress
      if (trimmed.startsWith("Status:") || trimmed.startsWith("Digest:")) return;

      // Try to parse Docker JSON-progress format (some daemon versions)
      try {
        const parsed = JSON.parse(trimmed) as {
          status?: string;
          id?: string;
          progress?: string;
        };
        if (parsed.status && parsed.id) {
          Queue.offer(queue, {
            stage: "pulling",
            layer: parsed.id,
            progress: parsed.progress ?? parsed.status,
          }).pipe(Effect.runSync);
          return;
        }
      } catch {
        // Not JSON — fall through to plain-text handling
      }

      // Plain-text line: emit it verbatim so the user can see what's happening
      Queue.offer(queue, { stage: "pulling", layer: "docker", progress: trimmed }).pipe(
        Effect.runSync,
      );
    };

    const flushLines = (buf: string, remaining: { current: string }) => {
      const all = buf;
      const lines = all.split("\n");
      remaining.current = lines.pop() ?? "";
      for (const line of lines) offerLine(line);
    };

    const stdoutRemaining = { current: "" };
    const stderrRemaining = { current: "" };

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      flushLines(stdoutBuf, stdoutRemaining);
      stdoutBuf = stdoutRemaining.current;
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderrFull += text;
      stderrBuf += text;
      flushLines(stderrBuf, stderrRemaining);
      stderrBuf = stderrRemaining.current;
    });

    child.on("close", (code) => {
      // Flush any remaining partial lines
      if (stdoutBuf) offerLine(stdoutBuf);
      if (stderrBuf) offerLine(stderrBuf);

      if (code === 0) {
        Queue.offer(queue, {
          stage: "complete",
          imageId: lastImageId || SANDBOX_IMAGE_REF,
        }).pipe(
          Effect.flatMap(() => Queue.end(queue)),
          Effect.runSync,
        );
      } else {
        Queue.failCause(
          queue,
          Cause.fail(
            new SandboxError({
              message: `docker pull failed (exit ${code ?? "unknown"}): ${stderrFull.trim() || "no output"}`,
            }),
          ),
        ).pipe(Effect.runSync);
      }
    });

    return Effect.void;
  });
}

async function startContainerImpl(workspacePath: string): Promise<SandboxHandle> {
  const bridgeHost = resolveDockerBridgeHost(process.platform as NodeJS.Platform);

  const { stdout } = await execFile(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "--memory",
      "8g",
      "--cpus",
      "2",
      "-v",
      `${workspacePath}:/workspace`,
      "--add-host",
      "host.docker.internal:host-gateway",
      "--cap-add",
      "SYS_PTRACE",
      "--security-opt",
      "seccomp=unconfined",
      SANDBOX_IMAGE_REF,
      "tail",
      "-f",
      "/dev/null",
    ],
    { timeout: 30_000 },
  );

  const containerId = stdout.trim();
  if (!containerId) {
    throw new Error("docker run did not return a container ID");
  }

  // Write helper script to workspace — if this fails, stop the container
  // so it doesn't leak (Issue #4: container start may leak).
  try {
    if (process.platform === "win32") {
      const scriptPath = path.join(workspacePath, "sb.cmd");
      fs.writeFileSync(scriptPath, `@echo off\ndocker exec -i ${containerId} bash -c "%*"\n`);
    } else {
      const scriptPath = path.join(workspacePath, "sb");
      fs.writeFileSync(scriptPath, `#!/bin/bash\ndocker exec -i ${containerId} bash -c "$*"\n`);
      fs.chmodSync(scriptPath, 0o755);
    }
  } catch (writeError) {
    // Best-effort stop the container before rethrowing
    try {
      await execFile("docker", ["stop", containerId], { timeout: 15_000 });
    } catch {
      // Swallow stop errors — the original write error is more important
    }
    throw writeError;
  }

  return { containerId, bridgeHost };
}

function buildImageStream(): Stream.Stream<SandboxInstallProgress, SandboxError> {
  return Stream.callback<SandboxInstallProgress, SandboxError>((queue) => {
    const dockerfilePath = path.join(REPO_ROOT, "sandbox", "Dockerfile");
    const child = spawn(
      "docker",
      ["build", "-f", dockerfilePath, "-t", SANDBOX_IMAGE_REF, REPO_ROOT],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let lastImageId = "";
    let stderrFull = "";
    let stdoutBuf = "";
    let stderrBuf = "";

    const offerLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Capture the final image ID from plain Docker output
      const builtMatch = trimmed.match(/^Successfully built ([a-f0-9]+)$/);
      if (builtMatch) {
        lastImageId = builtMatch[1] ?? "";
      }
      // BuildKit format: => => writing image sha256:abc...
      const shaMatch = trimmed.match(/sha256:([a-f0-9]{12,64})/);
      if (shaMatch) {
        lastImageId = shaMatch[1] ?? "";
      }

      Queue.offer(queue, { stage: "pulling", layer: "build", progress: trimmed }).pipe(
        Effect.runSync,
      );
    };

    const stdoutRemaining = { current: "" };
    const stderrRemaining = { current: "" };

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() ?? "";
      for (const line of lines) offerLine(line);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderrFull += text;
      stderrBuf += text;
      const lines = stderrBuf.split("\n");
      stderrBuf = lines.pop() ?? "";
      for (const line of lines) offerLine(line);
    });

    void stdoutRemaining;
    void stderrRemaining;

    child.on("close", (code) => {
      if (stdoutBuf) offerLine(stdoutBuf);
      if (stderrBuf) offerLine(stderrBuf);

      if (code === 0) {
        Queue.offer(queue, {
          stage: "complete",
          imageId: lastImageId || SANDBOX_IMAGE_REF,
        }).pipe(
          Effect.flatMap(() => Queue.end(queue)),
          Effect.runSync,
        );
      } else {
        Queue.failCause(
          queue,
          Cause.fail(
            new SandboxError({
              message: `docker build failed (exit ${code ?? "unknown"}): ${stderrFull.trim() || "no output"}`,
            }),
          ),
        ).pipe(Effect.runSync);
      }
    });

    return Effect.void;
  });
}

async function stopContainerImpl(handle: SandboxHandle): Promise<void> {
  await execFile("docker", ["stop", handle.containerId], { timeout: 15_000 });
}

const liveSandboxServiceShape: SandboxServiceShape = {
  isDockerAvailable: () =>
    Effect.tryPromise({
      try: () => isDockerAvailableImpl(),
      catch: () => new SandboxError({ message: "Failed to check Docker availability" }),
    }),

  isImageInstalled: () =>
    Effect.tryPromise({
      try: () => isImageInstalledImpl(),
      catch: () => new SandboxError({ message: "Failed to check sandbox image installation" }),
    }),

  installImage: () => installImageStream(),

  buildImage: () => buildImageStream(),

  startContainer: (workspacePath: string) =>
    Effect.tryPromise({
      try: () => startContainerImpl(workspacePath),
      catch: (cause) =>
        new SandboxError({
          message:
            cause instanceof Error
              ? `Failed to start sandbox container: ${cause.message}`
              : "Failed to start sandbox container",
          cause,
        }),
    }),

  stopContainer: (handle: SandboxHandle) =>
    Effect.tryPromise({
      try: () => stopContainerImpl(handle),
      catch: (cause) =>
        new SandboxError({
          message:
            cause instanceof Error
              ? `Failed to stop sandbox container: ${cause.message}`
              : "Failed to stop sandbox container",
          cause,
        }),
    }),
};

export const SandboxLayerLive = Layer.succeed(SandboxService, liveSandboxServiceShape);

const noopSandboxServiceShape: SandboxServiceShape = {
  isDockerAvailable: () => Effect.succeed(false),
  isImageInstalled: () => Effect.succeed(false),
  installImage: () =>
    Stream.fail(new SandboxError({ message: "Sandbox is not available in noop mode" })),
  buildImage: () =>
    Stream.fail(new SandboxError({ message: "Sandbox is not available in noop mode" })),
  startContainer: (_workspacePath: string) =>
    Effect.fail(new SandboxError({ message: "Sandbox is not available in noop mode" })),
  stopContainer: (_handle: SandboxHandle) =>
    Effect.fail(new SandboxError({ message: "Sandbox is not available in noop mode" })),
};

export const SandboxLayerNoop = Layer.succeed(SandboxService, noopSandboxServiceShape);

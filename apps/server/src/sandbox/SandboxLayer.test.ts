import { describe, it, assert } from "@effect/vitest";
import { Effect } from "effect";
import { vi, beforeEach } from "vitest";
import type { ThreadId } from "@flagcode/contracts";
import { startContainer, SandboxContainerError, type StartContainerInput } from "./SandboxLayer";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  default: {
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
}));

const { execFileSync } = await import("node:child_process");
const fs = (await import("node:fs")).default;

const mockedExecFileSync = vi.mocked(execFileSync);
const mockedWriteFileSync = vi.mocked(fs.writeFileSync);

function makeInput(overrides?: Partial<StartContainerInput>): StartContainerInput {
  return {
    threadId: "test-thread" as ThreadId,
    cwd: "/workspace/project",
    sandboxMode: "workspace-write",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("startContainer", () => {
  it.effect("creates container, writes helper scripts, and returns handle", () =>
    Effect.gen(function* () {
      mockedExecFileSync.mockReturnValueOnce("abc123\n");

      const handle = yield* startContainer(makeInput());

      assert.equal(handle.threadId, "test-thread");
      assert.equal(handle.containerId, "abc123");

      assert.equal(mockedExecFileSync.mock.calls.length, 1);
      const [cmd, args] = mockedExecFileSync.mock.calls[0]!;
      assert.equal(cmd, "docker");
      assert.ok((args as string[]).includes("run"));
      assert.equal(mockedWriteFileSync.mock.calls.length, 2);
    }),
  );

  it.effect("uses read-only volume mount for read-only sandbox mode", () =>
    Effect.gen(function* () {
      mockedExecFileSync.mockReturnValueOnce("ctr-ro\n");

      yield* startContainer(makeInput({ sandboxMode: "read-only" }));

      const [, args] = mockedExecFileSync.mock.calls[0]!;
      const volumeArg = (args as string[]).find((a) => a.includes("/workspace/project"));
      assert.ok(volumeArg?.endsWith(":ro"));
    }),
  );

  it.effect("uses privileged flag for danger-full-access sandbox mode", () =>
    Effect.gen(function* () {
      mockedExecFileSync.mockReturnValueOnce("ctr-priv\n");

      yield* startContainer(makeInput({ sandboxMode: "danger-full-access" }));

      const [, args] = mockedExecFileSync.mock.calls[0]!;
      assert.ok((args as string[]).includes("--privileged"));
    }),
  );

  it.effect("stops container when helper script writing fails", () =>
    Effect.gen(function* () {
      mockedExecFileSync.mockReturnValueOnce("leaky-ctr\n");
      mockedWriteFileSync.mockImplementationOnce(() => {
        throw new Error("EACCES: permission denied");
      });

      const error = yield* startContainer(makeInput()).pipe(Effect.flip);
      assert.ok(error instanceof SandboxContainerError);
      assert.equal(error.phase, "write-helper-scripts");
      assert.equal(error.containerId, "leaky-ctr");

      const stopCall = mockedExecFileSync.mock.calls.find(
        ([cmd, args]) => cmd === "docker" && (args as string[])[0] === "stop",
      );
      assert.ok(stopCall, "docker stop should clean up the orphaned container");
      assert.ok((stopCall![1] as string[]).includes("leaky-ctr"));
    }),
  );

  it.effect("fails with SandboxContainerError when docker run fails", () =>
    Effect.gen(function* () {
      mockedExecFileSync.mockImplementationOnce(() => {
        throw new Error("docker: command not found");
      });

      const error = yield* startContainer(makeInput()).pipe(Effect.flip);
      assert.ok(error instanceof SandboxContainerError);
      assert.equal(error.phase, "docker-run");

      assert.equal(mockedWriteFileSync.mock.calls.length, 0);
    }),
  );

  it.effect("handle.stop cleans up container and helper scripts", () =>
    Effect.gen(function* () {
      mockedExecFileSync.mockReturnValueOnce("cleanup-ctr\n");

      const handle = yield* startContainer(makeInput());
      vi.clearAllMocks();

      yield* handle.stop;

      const stopCall = mockedExecFileSync.mock.calls.find(
        ([cmd, args]) => cmd === "docker" && (args as string[])[0] === "stop",
      );
      assert.ok(stopCall);
      assert.equal(vi.mocked(fs.unlinkSync).mock.calls.length, 2);
    }),
  );
});

/**
 * SandboxHandles - Lifecycle tracker for sandbox containers.
 *
 * Both ClaudeAdapter and CodexAdapter create sandbox containers during
 * `startSession` and need to guarantee cleanup when:
 *
 * 1. `startSession` fails *after* the container is created but before the
 *    session is fully registered.
 * 2. `stopSession` removes a single session.
 * 3. `stopAll` / adapter finalizers shut the entire adapter down.
 *
 * This module provides a small, reusable utility that keeps a
 * `Map<ThreadId, SandboxHandle>` and exposes deterministic cleanup
 * helpers that are safe to call at any point (idempotent, best-effort
 * with logging, never throws).
 *
 * @module SandboxHandles
 */
import type { ThreadId } from "@flagcode/contracts";
import { Effect } from "effect";

// ---------------------------------------------------------------------------
// SandboxHandle
// ---------------------------------------------------------------------------

/**
 * Opaque handle to a running sandbox container.
 *
 * Implementations should make `stop` idempotent — calling it on an
 * already-stopped container is a no-op.
 */
export interface SandboxHandle {
  readonly threadId: ThreadId;
  readonly containerId: string;
  /**
   * Idempotent effect that stops and removes the container.
   * Must not throw — implementations should swallow/log errors internally
   * so that callers can safely fire-and-forget.
   */
  readonly stop: Effect.Effect<void>;
}

// ---------------------------------------------------------------------------
// SandboxHandleMap
// ---------------------------------------------------------------------------

export interface SandboxHandleMap {
  /** Register a handle. Replaces any previous handle for the same thread. */
  readonly register: (handle: SandboxHandle) => void;

  /** Look up the handle for a thread (if any). */
  readonly get: (threadId: ThreadId) => SandboxHandle | undefined;
  readonly stopOne: (threadId: ThreadId) => Effect.Effect<void>;

  /**
   * Stop every registered container and clear the map.
   */
  readonly stopAll: () => Effect.Effect<void>;

  /** Current number of tracked handles (useful for tests). */
  readonly size: () => number;
}
export function createSandboxHandleMap(): SandboxHandleMap {
  const handles = new Map<ThreadId, SandboxHandle>();

  const stopOne = (threadId: ThreadId): Effect.Effect<void> =>
    Effect.gen(function* () {
      const handle = handles.get(threadId);
      if (!handle) return;
      handles.delete(threadId);
      yield* handle.stop.pipe(
        Effect.catchCause((cause) =>
          Effect.logWarning("Failed to stop sandbox container", {
            threadId,
            containerId: handle.containerId,
            cause,
          }),
        ),
      );
    });

  const stopAllHandles = (): Effect.Effect<void> =>
    Effect.gen(function* () {
      const entries = Array.from(handles.entries());
      handles.clear();
      yield* Effect.forEach(
        entries,
        ([threadId, handle]) =>
          handle.stop.pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning("Failed to stop sandbox container during stopAll", {
                threadId,
                containerId: handle.containerId,
                cause,
              }),
            ),
          ),
        { discard: true, concurrency: "unbounded" },
      );
    });

  return {
    register: (handle) => handles.set(handle.threadId, handle),
    get: (threadId) => handles.get(threadId),
    stopOne,
    stopAll: stopAllHandles,
    size: () => handles.size,
  };
}

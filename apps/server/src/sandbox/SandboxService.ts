/**
 * SandboxService - Docker CTF sandbox service interface.
 *
 * Provides lifecycle management for Docker-based CTF sandbox containers.
 *
 * @module SandboxService
 */
import { Data, Effect, ServiceMap, Stream } from "effect";

export class SandboxError extends Data.TaggedError("SandboxError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface SandboxHandle {
  readonly containerId: string;
  readonly bridgeHost: string;
}

export type SandboxInstallProgress =
  | { readonly stage: "pulling"; readonly layer: string; readonly progress: string }
  | { readonly stage: "complete"; readonly imageId: string };

export interface SandboxServiceShape {
  readonly isDockerAvailable: () => Effect.Effect<boolean, SandboxError>;
  readonly isImageInstalled: () => Effect.Effect<boolean, SandboxError>;
  /** Pull the pre-built image from the remote registry. */
  readonly installImage: () => Stream.Stream<SandboxInstallProgress, SandboxError>;
  /**
   * Build the image locally from the repo's sandbox/Dockerfile.
   * The implementation resolves the Dockerfile location from its own source path.
   */
  readonly buildImage: () => Stream.Stream<SandboxInstallProgress, SandboxError>;
  readonly startContainer: (workspacePath: string) => Effect.Effect<SandboxHandle, SandboxError>;
  readonly stopContainer: (handle: SandboxHandle) => Effect.Effect<void, SandboxError>;
}

/**
 * SandboxService - Service tag for Docker CTF sandbox management.
 */
export class SandboxService extends ServiceMap.Service<SandboxService, SandboxServiceShape>()(
  "flagcode/sandbox/SandboxService",
) {}

import type {
  CommandId,
  MessageId,
  OrchestrationSwarm,
  SwarmId,
  ThreadId,
} from "@flagcode/contracts";
import { Cause, Effect, Layer } from "effect";

import { OrchestrationEngineService } from "../../orchestration/Services/OrchestrationEngine.ts";
import { SwarmCoordinator, type SwarmCoordinatorShape } from "../Services/SwarmCoordinator.ts";

const nowIso = () => new Date().toISOString();

const serverCommandId = (tag: string): CommandId =>
  `server:${tag}:${crypto.randomUUID()}` as CommandId;

const SWARM_PREAMBLE = `You are part of a solver swarm racing to capture the flag. Share discoveries by stating them clearly. If you find the flag, output it exactly as flag{...}.`;

const make = Effect.gen(function* () {
  const orchestrationEngine = yield* OrchestrationEngineService;

  const resolveSwarm = (swarmId: SwarmId) =>
    Effect.gen(function* () {
      const readModel = yield* orchestrationEngine.getReadModel();
      return readModel.swarms.find((entry) => entry.id === swarmId);
    });

  const buildSwarmPrompt = (
    swarm: OrchestrationSwarm,
    siblingFindings: ReadonlyArray<{ readonly summary: string }>,
  ): string => {
    const findingsBlock =
      siblingFindings.length > 0
        ? `\n\nFindings from teammates:\n${siblingFindings.map((f, i) => `${i + 1}. ${f.summary}`).join("\n")}`
        : "";
    return `${SWARM_PREAMBLE}${findingsBlock}\n\n---\n\n${swarm.challengePrompt}`;
  };

  const startSwarm: SwarmCoordinatorShape["startSwarm"] = (swarmId) =>
    Effect.gen(function* () {
      const swarm = yield* resolveSwarm(swarmId);
      if (!swarm) return;

      const now = nowIso();
      const threadIds: ThreadId[] = [];

      for (let i = 0; i < swarm.memberConfigs.length; i++) {
        const config = swarm.memberConfigs[i]!;
        const label = config.label ?? `Solver ${i + 1}`;
        const threadId = `swarm:${swarmId}:${i}:${crypto.randomUUID().slice(0, 8)}` as ThreadId;
        threadIds.push(threadId);

        yield* orchestrationEngine.dispatch({
          type: "thread.create" as const,
          commandId: serverCommandId("swarm-thread-create"),
          threadId,
          projectId: swarm.projectId,
          title: `[${swarm.title}] ${label}`,
          modelSelection: config.modelSelection,
          runtimeMode: "full-access" as const,
          interactionMode: "default" as const,
          branch: null,
          worktreePath: null,
          ...(swarm.ctfCategory ? { ctfCategory: swarm.ctfCategory } : {}),
          swarmId,
          swarmLabel: label,
          createdAt: now,
        } as any);
      }

      yield* orchestrationEngine.dispatch({
        type: "swarm.start",
        commandId: serverCommandId("swarm-start"),
        swarmId,
        threadIds,
        createdAt: now,
      });

      const prompt = buildSwarmPrompt(swarm, []);
      for (const threadId of threadIds) {
        const messageId = `swarm-msg:${crypto.randomUUID().slice(0, 8)}` as MessageId;
        yield* orchestrationEngine
          .dispatch({
            type: "thread.turn.start",
            commandId: serverCommandId("swarm-turn-start"),
            threadId,
            message: {
              messageId,
              role: "user" as const,
              text: prompt,
              attachments: [],
            },
            runtimeMode: "full-access" as const,
            interactionMode: "default" as const,
            createdAt: now,
          })
          .pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning("swarm coordinator: turn start failed", {
                threadId,
                swarmId,
                cause: Cause.pretty(cause),
              }),
            ),
          );
      }
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.logWarning("swarm coordinator: startSwarm failed", {
          swarmId,
          cause: Cause.pretty(cause),
        }),
      ),
    );

  const stopSwarm: SwarmCoordinatorShape["stopSwarm"] = (swarmId) =>
    Effect.gen(function* () {
      const swarm = yield* resolveSwarm(swarmId);
      if (!swarm) return;

      const now = nowIso();
      for (const threadId of swarm.threadIds) {
        yield* orchestrationEngine
          .dispatch({
            type: "thread.turn.interrupt",
            commandId: serverCommandId("swarm-thread-interrupt"),
            threadId,
            createdAt: now,
          })
          .pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning("swarm coordinator: interrupt failed", {
                threadId,
                swarmId,
                cause: Cause.pretty(cause),
              }),
            ),
          );
      }
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.logWarning("swarm coordinator: stopSwarm failed", {
          swarmId,
          cause: Cause.pretty(cause),
        }),
      ),
    );

  const interruptSiblings: SwarmCoordinatorShape["interruptSiblings"] = (swarmId, winnerThreadId) =>
    Effect.gen(function* () {
      const swarm = yield* resolveSwarm(swarmId);
      if (!swarm) return;

      const now = nowIso();
      for (const threadId of swarm.threadIds) {
        if (threadId === winnerThreadId) continue;
        yield* orchestrationEngine
          .dispatch({
            type: "thread.turn.interrupt",
            commandId: serverCommandId("swarm-sibling-interrupt"),
            threadId,
            createdAt: now,
          })
          .pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning("swarm coordinator: sibling interrupt failed", {
                threadId,
                swarmId,
                winnerThreadId,
                cause: Cause.pretty(cause),
              }),
            ),
          );
      }
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.logWarning("swarm coordinator: interruptSiblings failed", {
          swarmId,
          cause: Cause.pretty(cause),
        }),
      ),
    );

  return {
    startSwarm,
    stopSwarm,
    interruptSiblings,
  } satisfies SwarmCoordinatorShape;
});

export const SwarmCoordinatorLive = Layer.effect(SwarmCoordinator, make);

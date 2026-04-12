import type {
  CommandId,
  FindingId,
  OrchestrationEvent,
  SwarmId,
  ThreadId,
} from "@flagcode/contracts";
import { Cause, Effect, Layer, Stream } from "effect";
import { makeDrainableWorker } from "@flagcode/shared/DrainableWorker";

import { OrchestrationEngineService } from "../../orchestration/Services/OrchestrationEngine.ts";
import { SwarmCoordinator } from "../Services/SwarmCoordinator.ts";
import { SwarmMessageBus } from "../Services/SwarmMessageBus.ts";
import { SwarmReactor, type SwarmReactorShape } from "../Services/SwarmReactor.ts";

const FLAG_PATTERN = /flag\{[^}]+\}/i;

type SwarmIntentEvent = Extract<
  OrchestrationEvent,
  {
    type:
      | "swarm.created"
      | "swarm.started"
      | "swarm.flag-found"
      | "swarm.stopped"
      | "thread.turn-diff-completed"
      | "thread.message-sent";
  }
>;

const serverCommandId = (tag: string): CommandId =>
  `server:${tag}:${crypto.randomUUID()}` as CommandId;

const nowIso = () => new Date().toISOString();

const make = Effect.gen(function* () {
  const orchestrationEngine = yield* OrchestrationEngineService;
  const coordinator = yield* SwarmCoordinator;
  const messageBus = yield* SwarmMessageBus;

  const findSwarmForThread = (threadId: string) =>
    Effect.gen(function* () {
      const readModel = yield* orchestrationEngine.getReadModel();
      const thread = readModel.threads.find((t) => t.id === threadId);
      if (!thread || !thread.swarmId) return undefined;
      return readModel.swarms.find((s) => s.id === thread.swarmId);
    });

  const nextFindingSequence = new Map<string, number>();

  const getNextSequence = (swarmId: SwarmId): number => {
    const current = nextFindingSequence.get(swarmId) ?? 0;
    nextFindingSequence.set(swarmId, current + 1);
    return current;
  };

  const processDomainEvent = Effect.fn("processDomainEvent")(function* (event: SwarmIntentEvent) {
    switch (event.type) {
      case "swarm.created":
        return;

      case "swarm.started": {
        yield* coordinator.startSwarm(event.payload.swarmId);
        return;
      }

      case "swarm.flag-found": {
        yield* coordinator.interruptSiblings(event.payload.swarmId, event.payload.threadId);
        yield* messageBus.postFinding({
          id: `finding:${crypto.randomUUID().slice(0, 8)}` as FindingId,
          swarmId: event.payload.swarmId,
          threadId: event.payload.threadId,
          kind: "flag",
          summary: `Flag found: ${event.payload.flagValue}`,
          detail: event.payload.flagValue,
          sequence: getNextSequence(event.payload.swarmId) as any,
          createdAt: event.payload.createdAt,
        });
        return;
      }

      case "swarm.stopped": {
        yield* coordinator.stopSwarm(event.payload.swarmId);
        return;
      }

      case "thread.message-sent": {
        const payload = event.payload as unknown as {
          threadId: string;
          role: string;
          text: string;
        };
        if (payload.role !== "assistant") return;

        const swarm = yield* findSwarmForThread(payload.threadId);
        if (!swarm || swarm.status !== "running") return;

        const flagMatch = payload.text.match(FLAG_PATTERN);
        if (flagMatch) {
          yield* orchestrationEngine
            .dispatch({
              type: "swarm.flag-found",
              commandId: serverCommandId("swarm-flag-detected"),
              swarmId: swarm.id,
              threadId: payload.threadId as ThreadId,
              flagValue: flagMatch[0],
              createdAt: nowIso(),
            })
            .pipe(
              Effect.catchCause((cause) =>
                Effect.logWarning("swarm reactor: flag-found dispatch failed", {
                  swarmId: swarm.id,
                  cause: Cause.pretty(cause),
                }),
              ),
            );
          return;
        }

        if (payload.text.length > 50) {
          const summary =
            payload.text.length > 200 ? `${payload.text.slice(0, 197)}...` : payload.text;
          yield* messageBus
            .postFinding({
              id: `finding:${crypto.randomUUID().slice(0, 8)}` as FindingId,
              swarmId: swarm.id,
              threadId: payload.threadId as ThreadId,
              kind: "progress",
              summary,
              sequence: getNextSequence(swarm.id) as number & {
                readonly FindingId: "FindingId";
                readonly ThreadId: "ThreadId";
              },
              createdAt: nowIso(),
            })
            .pipe(
              Effect.catchCause((cause) =>
                Effect.logWarning("swarm reactor: progress finding post failed", {
                  swarmId: swarm.id,
                  cause: Cause.pretty(cause),
                }),
              ),
            );
        }
        return;
      }

      case "thread.turn-diff-completed": {
        const payload = event.payload as unknown as { threadId: string };
        const swarm = yield* findSwarmForThread(payload.threadId);
        if (!swarm || swarm.status !== "running") return;
        return;
      }
    }
  });

  const processDomainEventSafely = (event: SwarmIntentEvent) =>
    processDomainEvent(event).pipe(
      Effect.catchCause((cause) => {
        if (Cause.hasInterruptsOnly(cause)) {
          return Effect.failCause(cause);
        }
        return Effect.logWarning("swarm reactor: event processing failed", {
          eventType: event.type,
          cause: Cause.pretty(cause),
        });
      }),
    );

  const worker = yield* makeDrainableWorker(processDomainEventSafely);

  const start: SwarmReactorShape["start"] = Effect.fn("start")(function* () {
    const processEvent = Effect.fn("processEvent")(function* (event: OrchestrationEvent) {
      if (
        event.type === "swarm.created" ||
        event.type === "swarm.started" ||
        event.type === "swarm.flag-found" ||
        event.type === "swarm.stopped" ||
        event.type === "thread.turn-diff-completed" ||
        event.type === "thread.message-sent"
      ) {
        return yield* worker.enqueue(event);
      }
    });

    yield* Effect.forkScoped(
      Stream.runForEach(orchestrationEngine.streamDomainEvents, processEvent),
    );
  });

  return {
    start,
    drain: worker.drain,
  } satisfies SwarmReactorShape;
});

export const SwarmReactorLive = Layer.effect(SwarmReactor, make);

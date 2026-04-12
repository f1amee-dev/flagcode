import { describe, it, expect } from "bun:test";
import { Effect } from "effect";
import type {
  OrchestrationCommand,
  OrchestrationReadModel,
  SwarmId,
  ProjectId,
  ThreadId,
} from "@flagcode/contracts";
import { decideOrchestrationCommand } from "../orchestration/decider.ts";
import { projectEvent, createEmptyReadModel } from "../orchestration/projector.ts";

const PROJECT_ID = "test-project" as ProjectId;
const SWARM_ID = "test-swarm" as SwarmId;
const THREAD_ID = "thread-1" as ThreadId;

function makeReadModel(overrides?: Partial<OrchestrationReadModel>): OrchestrationReadModel {
  return {
    ...createEmptyReadModel(new Date().toISOString()),
    projects: [
      {
        id: PROJECT_ID,
        title: "Test Project",
        workspaceRoot: "/tmp/test",
        defaultModelSelection: null,
        scripts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      },
    ],
    ...overrides,
  };
}

function decide(command: OrchestrationCommand, readModel: OrchestrationReadModel) {
  return Effect.runPromise(decideOrchestrationCommand({ command, readModel }));
}

describe("swarm decider", () => {
  it("swarm.create emits swarm.created", async () => {
    const rm = makeReadModel();
    const event = await decide(
      {
        type: "swarm.create",
        commandId: "cmd-1" as any,
        swarmId: SWARM_ID,
        projectId: PROJECT_ID,
        title: "Baby Crypto",
        challengePrompt: "Solve this crypto challenge",
        memberConfigs: [
          { modelSelection: { provider: "codex", model: "o3" } },
          { modelSelection: { provider: "claudeAgent", model: "claude-sonnet-4-20250514" } },
        ],
        createdAt: new Date().toISOString(),
      },
      rm,
    );

    const single = Array.isArray(event) ? event[0] : event;
    expect(single.type).toBe("swarm.created");
    expect((single.payload as any).swarmId).toBe(SWARM_ID);
    expect((single.payload as any).memberConfigs).toHaveLength(2);
  });

  it("swarm.create rejects duplicate swarm", async () => {
    const rm = makeReadModel({
      swarms: [
        {
          id: SWARM_ID,
          projectId: PROJECT_ID,
          title: "Existing",
          challengePrompt: "x",
          ctfCategory: null,
          threadIds: [],
          memberConfigs: [],
          status: "pending",
          winnerThreadId: null,
          flagValue: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    await expect(
      decide(
        {
          type: "swarm.create",
          commandId: "cmd-2" as any,
          swarmId: SWARM_ID,
          projectId: PROJECT_ID,
          title: "Dup",
          challengePrompt: "x",
          memberConfigs: [],
          createdAt: new Date().toISOString(),
        },
        rm,
      ),
    ).rejects.toThrow();
  });

  it("swarm.start rejects non-pending swarm", async () => {
    const rm = makeReadModel({
      swarms: [
        {
          id: SWARM_ID,
          projectId: PROJECT_ID,
          title: "Running",
          challengePrompt: "x",
          ctfCategory: null,
          threadIds: [],
          memberConfigs: [],
          status: "running",
          winnerThreadId: null,
          flagValue: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    await expect(
      decide(
        {
          type: "swarm.start",
          commandId: "cmd-3" as any,
          swarmId: SWARM_ID,
          threadIds: [],
          createdAt: new Date().toISOString(),
        },
        rm,
      ),
    ).rejects.toThrow();
  });

  it("swarm.flag-found rejects non-running swarm", async () => {
    const rm = makeReadModel({
      swarms: [
        {
          id: SWARM_ID,
          projectId: PROJECT_ID,
          title: "Stopped",
          challengePrompt: "x",
          ctfCategory: null,
          threadIds: [THREAD_ID],
          memberConfigs: [],
          status: "stopped",
          winnerThreadId: null,
          flagValue: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    await expect(
      decide(
        {
          type: "swarm.flag-found",
          commandId: "cmd-4" as any,
          swarmId: SWARM_ID,
          threadId: THREAD_ID,
          flagValue: "flag{test}",
          createdAt: new Date().toISOString(),
        },
        rm,
      ),
    ).rejects.toThrow();
  });

  it("swarm.stop emits swarm.stopped for running swarm", async () => {
    const rm = makeReadModel({
      swarms: [
        {
          id: SWARM_ID,
          projectId: PROJECT_ID,
          title: "Running",
          challengePrompt: "x",
          ctfCategory: null,
          threadIds: [],
          memberConfigs: [],
          status: "running",
          winnerThreadId: null,
          flagValue: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    const event = await decide(
      {
        type: "swarm.stop",
        commandId: "cmd-5" as any,
        swarmId: SWARM_ID,
        createdAt: new Date().toISOString(),
      },
      rm,
    );
    const single = Array.isArray(event) ? event[0] : event;
    expect(single.type).toBe("swarm.stopped");
  });
});

describe("swarm projector", () => {
  it("projects swarm.created into read model", async () => {
    const rm = createEmptyReadModel(new Date().toISOString());
    const event = {
      sequence: 1,
      eventId: "evt-1" as any,
      aggregateKind: "swarm" as const,
      aggregateId: SWARM_ID as any,
      occurredAt: new Date().toISOString(),
      commandId: "cmd-1" as any,
      causationEventId: null,
      correlationId: "cmd-1" as any,
      metadata: {},
      type: "swarm.created" as const,
      payload: {
        swarmId: SWARM_ID,
        projectId: PROJECT_ID,
        title: "Test Swarm",
        challengePrompt: "Solve it",
        ctfCategory: null,
        memberConfigs: [{ modelSelection: { provider: "codex" as const, model: "o3" } }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    const next = await Effect.runPromise(projectEvent(rm, event));
    expect(next.swarms).toHaveLength(1);
    expect(next.swarms[0]!.id).toBe(SWARM_ID);
    expect(next.swarms[0]!.status).toBe("pending");
    expect(next.swarms[0]!.memberConfigs).toHaveLength(1);
  });

  it("projects swarm.flag-found -> solved with winner", async () => {
    const rm: OrchestrationReadModel = {
      ...createEmptyReadModel(new Date().toISOString()),
      swarms: [
        {
          id: SWARM_ID,
          projectId: PROJECT_ID,
          title: "Running",
          challengePrompt: "x",
          ctfCategory: null,
          threadIds: [THREAD_ID],
          memberConfigs: [],
          status: "running",
          winnerThreadId: null,
          flagValue: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    const event = {
      sequence: 2,
      eventId: "evt-2" as any,
      aggregateKind: "swarm" as const,
      aggregateId: SWARM_ID as any,
      occurredAt: new Date().toISOString(),
      commandId: "cmd-2" as any,
      causationEventId: null,
      correlationId: "cmd-2" as any,
      metadata: {},
      type: "swarm.flag-found" as const,
      payload: {
        swarmId: SWARM_ID,
        threadId: THREAD_ID,
        flagValue: "flag{test123}",
        createdAt: new Date().toISOString(),
      },
    };

    const next = await Effect.runPromise(projectEvent(rm, event));
    expect(next.swarms[0]!.status).toBe("solved");
    expect(next.swarms[0]!.winnerThreadId).toBe(THREAD_ID);
    expect(next.swarms[0]!.flagValue).toBe("flag{test123}");
  });

  it("projects swarm.stopped -> stopped status", async () => {
    const rm: OrchestrationReadModel = {
      ...createEmptyReadModel(new Date().toISOString()),
      swarms: [
        {
          id: SWARM_ID,
          projectId: PROJECT_ID,
          title: "Running",
          challengePrompt: "x",
          ctfCategory: null,
          threadIds: [],
          memberConfigs: [],
          status: "running",
          winnerThreadId: null,
          flagValue: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    const event = {
      sequence: 3,
      eventId: "evt-3" as any,
      aggregateKind: "swarm" as const,
      aggregateId: SWARM_ID as any,
      occurredAt: new Date().toISOString(),
      commandId: "cmd-3" as any,
      causationEventId: null,
      correlationId: "cmd-3" as any,
      metadata: {},
      type: "swarm.stopped" as const,
      payload: {
        swarmId: SWARM_ID,
        createdAt: new Date().toISOString(),
      },
    };

    const next = await Effect.runPromise(projectEvent(rm, event));
    expect(next.swarms[0]!.status).toBe("stopped");
  });
});

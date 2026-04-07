import { it, assert } from "@effect/vitest";
import { Effect, Ref } from "effect";
import type { ThreadId } from "@flagcode/contracts";
import { createSandboxHandleMap, type SandboxHandle } from "./SandboxHandles";

function makeHandle(threadId: string, stopRef: Ref.Ref<string[]>): SandboxHandle {
  return {
    threadId: threadId as ThreadId,
    containerId: `ctr-${threadId}`,
    stop: Ref.update(stopRef, (ids) => [...ids, threadId]),
  };
}

it.effect("stopOne stops and removes a single handle", () =>
  Effect.gen(function* () {
    const ref = yield* Ref.make<string[]>([]);
    const map = createSandboxHandleMap();
    map.register(makeHandle("t1", ref));
    map.register(makeHandle("t2", ref));
    assert.equal(map.size(), 2);

    yield* map.stopOne("t1" as ThreadId);
    assert.deepEqual(yield* Ref.get(ref), ["t1"]);
    assert.equal(map.size(), 1);
    assert.equal(map.get("t1" as ThreadId), undefined);
    assert.notEqual(map.get("t2" as ThreadId), undefined);
  }),
);

it.effect("stopOne is a no-op for unknown thread", () =>
  Effect.gen(function* () {
    const map = createSandboxHandleMap();
    yield* map.stopOne("unknown" as ThreadId);
    assert.equal(map.size(), 0);
  }),
);

it.effect("stopAll stops every handle and clears the map", () =>
  Effect.gen(function* () {
    const ref = yield* Ref.make<string[]>([]);
    const map = createSandboxHandleMap();
    map.register(makeHandle("a", ref));
    map.register(makeHandle("b", ref));
    map.register(makeHandle("c", ref));

    yield* map.stopAll();
    const stopped = yield* Ref.get(ref);
    assert.equal(stopped.length, 3);
    assert.ok(stopped.includes("a"));
    assert.ok(stopped.includes("b"));
    assert.ok(stopped.includes("c"));
    assert.equal(map.size(), 0);
  }),
);

it.effect("stopAll continues past individual handle failures", () =>
  Effect.gen(function* () {
    const ref = yield* Ref.make<string[]>([]);
    const map = createSandboxHandleMap();
    map.register(makeHandle("ok1", ref));
    map.register({
      threadId: "fail" as ThreadId,
      containerId: "ctr-fail",
      stop: Effect.die(new Error("boom")),
    });
    map.register(makeHandle("ok2", ref));

    yield* map.stopAll();
    const stopped = yield* Ref.get(ref);
    assert.ok(stopped.includes("ok1"));
    assert.ok(stopped.includes("ok2"));
    assert.equal(map.size(), 0);
  }),
);

it.effect("register replaces a previous handle for the same thread", () =>
  Effect.gen(function* () {
    const ref = yield* Ref.make<string[]>([]);
    const map = createSandboxHandleMap();
    const old = makeHandle("t1", ref);
    map.register(old);

    const replacement: SandboxHandle = {
      threadId: "t1" as ThreadId,
      containerId: "ctr-t1-v2",
      stop: Ref.update(ref, (ids) => [...ids, "t1-v2"]),
    };
    map.register(replacement);

    assert.equal(map.size(), 1);
    assert.equal(map.get("t1" as ThreadId)?.containerId, "ctr-t1-v2");

    yield* map.stopOne("t1" as ThreadId);
    const stopped = yield* Ref.get(ref);
    assert.deepEqual(stopped, ["t1-v2"]);
  }),
);

it.effect("stopOne is idempotent", () =>
  Effect.gen(function* () {
    const ref = yield* Ref.make<string[]>([]);
    const map = createSandboxHandleMap();
    map.register(makeHandle("t1", ref));

    yield* map.stopOne("t1" as ThreadId);
    yield* map.stopOne("t1" as ThreadId);
    assert.deepEqual(yield* Ref.get(ref), ["t1"]);
    assert.equal(map.size(), 0);
  }),
);

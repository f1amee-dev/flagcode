import type { SwarmFinding, SwarmId } from "@flagcode/contracts";
import { Context } from "effect";
import type { Effect, Stream } from "effect";

export interface SwarmMessageBusShape {
  readonly postFinding: (finding: SwarmFinding) => Effect.Effect<void>;
  readonly readFindings: (
    swarmId: SwarmId,
    afterSequence?: number,
  ) => Effect.Effect<ReadonlyArray<SwarmFinding>>;
  readonly streamFindings: (swarmId: SwarmId) => Stream.Stream<SwarmFinding>;
}

export class SwarmMessageBus extends Context.Service<SwarmMessageBus, SwarmMessageBusShape>()(
  "flagcode/swarm/Services/SwarmMessageBus",
) {}

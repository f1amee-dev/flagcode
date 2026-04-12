import type { SwarmId } from "@flagcode/contracts";
import { Context } from "effect";
import type { Effect } from "effect";

export interface SwarmCoordinatorShape {
  readonly startSwarm: (swarmId: SwarmId) => Effect.Effect<void>;
  readonly stopSwarm: (swarmId: SwarmId) => Effect.Effect<void>;
  readonly interruptSiblings: (swarmId: SwarmId, winnerThreadId: string) => Effect.Effect<void>;
}

export class SwarmCoordinator extends Context.Service<SwarmCoordinator, SwarmCoordinatorShape>()(
  "flagcode/swarm/Services/SwarmCoordinator",
) {}

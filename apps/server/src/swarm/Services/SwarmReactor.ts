import { Context } from "effect";
import type { Effect, Scope } from "effect";

export interface SwarmReactorShape {
  readonly start: () => Effect.Effect<void, never, Scope.Scope>;
  readonly drain: Effect.Effect<void>;
}

export class SwarmReactor extends Context.Service<SwarmReactor, SwarmReactorShape>()(
  "flagcode/swarm/Services/SwarmReactor",
) {}

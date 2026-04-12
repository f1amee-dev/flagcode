import type { SwarmFinding, SwarmId } from "@flagcode/contracts";
import { Cause, Effect, Layer, PubSub, Stream } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { SwarmMessageBus, type SwarmMessageBusShape } from "../Services/SwarmMessageBus.ts";

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const findingsPubSub = yield* PubSub.unbounded<SwarmFinding>();

  const postFinding: SwarmMessageBusShape["postFinding"] = (finding) =>
    Effect.gen(function* () {
      yield* sql`
        INSERT OR IGNORE INTO swarm_findings (id, swarm_id, thread_id, kind, summary, detail, sequence, created_at)
        VALUES (${finding.id}, ${finding.swarmId}, ${finding.threadId}, ${finding.kind}, ${finding.summary}, ${finding.detail ?? null}, ${finding.sequence}, ${finding.createdAt})
      `;
      yield* PubSub.publish(findingsPubSub, finding);
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.logWarning("swarm message bus: post finding failed", {
          findingId: finding.id,
          cause: Cause.pretty(cause),
        }),
      ),
    );

  const readFindings: SwarmMessageBusShape["readFindings"] = (swarmId, afterSequence) =>
    Effect.gen(function* () {
      const minSeq = afterSequence ?? -1;
      const rows = yield* sql<{
        readonly id: string;
        readonly swarm_id: string;
        readonly thread_id: string;
        readonly kind: string;
        readonly summary: string;
        readonly detail: string | null;
        readonly sequence: number;
        readonly created_at: string;
      }>`
        SELECT id, swarm_id, thread_id, kind, summary, detail, sequence, created_at
        FROM swarm_findings
        WHERE swarm_id = ${swarmId} AND sequence > ${minSeq}
        ORDER BY sequence ASC
      `;
      return rows.map((row) => ({
        id: row.id as SwarmFinding["id"],
        swarmId: row.swarm_id as SwarmFinding["swarmId"],
        threadId: row.thread_id as SwarmFinding["threadId"],
        kind: row.kind as SwarmFinding["kind"],
        summary: row.summary,
        ...(row.detail !== null ? { detail: row.detail } : {}),
        sequence: row.sequence as SwarmFinding["sequence"],
        createdAt: row.created_at as SwarmFinding["createdAt"],
      }));
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.logWarning("swarm message bus: read findings failed", {
          swarmId,
          cause: Cause.pretty(cause),
        }).pipe(Effect.as([] as ReadonlyArray<SwarmFinding>)),
      ),
    );

  const streamFindings: SwarmMessageBusShape["streamFindings"] = (swarmId: SwarmId) =>
    Stream.fromPubSub(findingsPubSub).pipe(Stream.filter((finding) => finding.swarmId === swarmId));

  return {
    postFinding,
    readFindings,
    streamFindings,
  } satisfies SwarmMessageBusShape;
});

export const SwarmMessageBusLive = Layer.effect(SwarmMessageBus, make);

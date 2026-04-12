import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Drop the existing non-unique index
  yield* sql`DROP INDEX IF EXISTS idx_swarm_findings_swarm_seq`;
  yield* sql`
    DELETE FROM swarm_findings
    WHERE rowid NOT IN (
      SELECT MAX(rowid)
      FROM swarm_findings
      GROUP BY swarm_id, sequence
    )
  `;

  // Replace with a UNIQUE index so duplicate (swarm_id, sequence) pairs
  // are rejected at the DB level.
  yield* sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_swarm_findings_swarm_seq
    ON swarm_findings (swarm_id, sequence)
  `;
});

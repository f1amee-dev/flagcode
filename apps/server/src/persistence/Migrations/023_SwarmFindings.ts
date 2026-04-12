import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS swarm_findings (
      id TEXT PRIMARY KEY NOT NULL,
      swarm_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      summary TEXT NOT NULL,
      detail TEXT,
      sequence INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_swarm_findings_swarm_seq
    ON swarm_findings (swarm_id, sequence)
  `;
});

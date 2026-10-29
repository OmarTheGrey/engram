// A writer process for the cross-process test in postgres.test.ts: it opens
// the Postgres log in a schema, waits until every writer is connected, then
// appends `count` write events as `actor` as fast as it can, and prints one
// JSON line with how many it appended and the first error, if any.
// Usage: node append-writer.ts <url> <schema> <writer index> <writers> <count>
import { openPostgres } from "../../src/db/postgres.ts";
import { appendEvent } from "../../src/events.ts";
import type { MemoryItem } from "../../src/schema.ts";

const [url = "", schema = "", indexArg = "1", writersArg = "2", countArg = "0"] =
  process.argv.slice(2);
const index = Number(indexArg);
const actor = `agent:writer${index}`;
const id = (n: number) => `0192000${index}-0000-7000-8000-${String(n).padStart(12, "0")}`;

const item = (n: number): MemoryItem => ({
  id: id(0),
  class: "episodic",
  scope: "team:platform",
  owner: actor,
  content: `observation ${n}`,
  provenance: { kind: "tool", ref: "tool/1", hash: `sha256:${"ab".repeat(32)}`, actor },
  confidence: 0.5,
  valid_from: "2026-10-29T09:00:00Z",
  valid_to: null,
  ttl: null,
  grants: [],
  version: 1,
  lineage: [],
  status: "active",
  store_ref: { adapter: "fake", key: actor },
  schema_version: 0,
});

const db = openPostgres(url);
let appended = 0;
let error: string | undefined;
try {
  db.exec(`SET search_path TO ${schema}`);
  db.prepare("INSERT INTO ready VALUES (?)").run(actor);
  while (Number(db.prepare("SELECT count(*) AS n FROM ready").get()?.n) < Number(writersArg)) {
    // Spin until every writer is connected, so the appends overlap.
  }
  for (let n = 1; n <= Number(countArg); n++) {
    appendEvent(db, {
      id: id(n),
      ts: "2026-10-29T09:00:00Z",
      op: "write",
      item_id: id(0),
      actor,
      scope_from: null,
      scope_to: "team:platform",
      decision: "allow",
      reason: "allowed",
      policy_id: "p/write",
      item: item(n),
      schema_version: 0,
    });
    appended++;
  }
} catch (e) {
  error = e instanceof Error ? e.message : String(e);
  process.exitCode = 1;
} finally {
  db.close();
}
process.stdout.write(`${JSON.stringify({ actor, appended, error })}\n`);

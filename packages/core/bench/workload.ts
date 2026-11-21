// The workload of the plane-overhead suite (card X15): a store of `size`
// background items written through the real Plane, the calls the suite times
// on it, and the bare node:sqlite baseline beside them. Everything here is
// deterministic: ids are counters, every call carries the same injected time,
// and nothing draws randomness. Only plane-overhead.ts reads a clock.
//
// The store. `size` semantic items, user-sourced, written by one owner under
// preset medium into team scopes of at most SCOPE_SIZE items each
// (team:bg-0000, team:bg-0001, ...), so no scope passes any preset's team
// budget for semantic items (strict 2,000, medium 10,000, permissive
// more). Exactly `hits` of them hold the word "needle", spread evenly.
//
// The calls, each timed under every preset over the same log and store:
// - `write`: an allowed write of a new semantic item into the writer's own
//   person scope (person:bench-<preset>), the path every preset allows to a
//   user; it pays the gate, the store write, the event and the budget check.
// - `write-deny`: a write into a scope the writer is not a member of
//   (engram/write/membership), the same decision in every preset; it pays
//   the gate and one event and never reaches the store.
// - `read`: the team-level reader, a member of every background scope, reads
//   "needle": `hits` items come back, each explained, and one read event
//   with the explanations is appended.
// The baseline, on its own database file with the same pragmas: an INSERT of
// one row (`sqlite-write`) and a SELECT of the rows holding "needle" in the
// background scopes (`sqlite-read`) over a table of `size` rows.
import { DatabaseSync } from "node:sqlite";
import type { Actor } from "../src/actor.ts";
import type { Adapter } from "../src/adapter.ts";
import type { Db } from "../src/db/db.ts";
import { BUSY_TIMEOUT_MS } from "../src/db/sqlite.ts";
import { createPlane, type Plane } from "../src/plane.ts";
import type { MemoryItem, Policy } from "../src/schema.ts";

/** The most background items one team scope holds. */
export const SCOPE_SIZE = 1000;
/** The word the read asks for. */
export const NEEDLE = "needle";

const hex12 = (n: number) => n.toString(16).padStart(12, "0");
/** Item ids, one range per use, so no two calls share an id. */
export const itemId = (range: number, n: number) =>
  `0193${range.toString(16).padStart(4, "0")}-0000-7000-8000-${hex12(n)}`;

export const backgroundScope = (k: number) => `team:bg-${String(k).padStart(4, "0")}`;
export const scopeCount = (size: number) => Math.max(1, Math.ceil(size / SCOPE_SIZE));

/** Whether background item `n` of a store of `size` holds the needle. */
export function holdsNeedle(n: number, size: number, hits: number): boolean {
  const step = Math.floor(size / hits);
  return n % step === 0 && n / step < hits;
}

export const OWNER = "person:owner";
const ZERO_HASH = `sha256:${"0".repeat(64)}`;

export function item(
  id: string,
  scope: string,
  owner: string,
  content: string,
  cls: MemoryItem["class"] = "semantic",
): MemoryItem {
  return {
    id,
    class: cls,
    scope,
    owner,
    content,
    provenance: { kind: "user", ref: "bench/x15", hash: ZERO_HASH, actor: owner },
    confidence: 0.9,
    valid_from: "2026-10-01T00:00:00Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
  } as MemoryItem;
}

/** Background item `n`: its content names its number, and the needle when it holds one. */
export function backgroundItem(n: number, size: number, hits: number): MemoryItem {
  const content = holdsNeedle(n, size, hits)
    ? `fact ${n} about subject ${n % 97} and the ${NEEDLE}`
    : `fact ${n} about subject ${n % 97}`;
  return item(itemId(1, n), backgroundScope(Math.floor(n / SCOPE_SIZE)), OWNER, content);
}

export const ownerActor = (size: number): Actor => ({
  id: OWNER,
  level: "team",
  memberships: Array.from({ length: scopeCount(size) }, (_, k) => backgroundScope(k)),
  source: "user",
});

export const readerActor = (size: number): Actor => ({
  id: "person:reader",
  level: "team",
  memberships: Array.from({ length: scopeCount(size) }, (_, k) => backgroundScope(k)),
  source: "user",
});

export const writerActor = (preset: string): Actor => ({
  id: `person:bench-${preset}`,
  level: "person",
  memberships: [`person:bench-${preset}`],
  source: "user",
});

/** A plane over `db` and `adapter` under `policy`, its event ids from `next`. */
export function planeOver(db: Db, adapter: Adapter, policy: Policy, next: () => number): Plane {
  return createPlane({ db, adapter, policy, newId: () => itemId(0xe, next()) });
}

/** Writes the background through `plane`; throws if any write is not allowed. */
export async function populate(plane: Plane, size: number, hits: number, at: string) {
  const owner = ownerActor(size);
  for (let n = 0; n < size; n++) {
    const { event } = await plane.write(owner, backgroundItem(n, size, hits), at);
    if (event.decision !== "allow")
      throw new Error(`populate: write ${n} was ${event.decision}: ${event.reason}`);
  }
}

export type Op = "write" | "write-deny" | "read";
export const OPS: readonly Op[] = ["write", "write-deny", "read"];

/**
 * One timed call of `op` under `preset`; `n` numbers it, so each write has
 * its own id. Throws if the call did not do what the suite measures.
 */
export function call(plane: Plane, op: Op, preset: string, size: number, hits: number, at: string) {
  const writer = writerActor(preset);
  const range = 0x100 + ["strict", "medium", "permissive"].indexOf(preset);
  return async (n: number) => {
    if (op === "write") {
      const target = item(itemId(range, n), writer.memberships[0] ?? "", writer.id, `note ${n}`);
      const { event } = await plane.write(writer, target, at);
      if (event.decision !== "allow") throw new Error(`write ${n}: ${event.reason}`);
    } else if (op === "write-deny") {
      const target = item(itemId(range + 0x10, n), backgroundScope(0), writer.id, `note ${n}`);
      const { event } = await plane.write(writer, target, at);
      if (event.decision !== "deny") throw new Error(`write-deny ${n} was ${event.decision}`);
    } else {
      const result = await plane.read(readerActor(size), { text: NEEDLE, at });
      if (result.items.length !== hits)
        throw new Error(`read returned ${result.items.length} items, not ${hits}`);
    }
  };
}

export type BaselineOp = "sqlite-write" | "sqlite-read";
export const BASELINE_OPS: readonly BaselineOp[] = ["sqlite-write", "sqlite-read"];

/** The bare node:sqlite baseline: a table of `size` rows shaped like the background. */
export function openBaseline(path: string, size: number, hits: number) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  db.exec("CREATE TABLE items (id TEXT PRIMARY KEY, scope TEXT NOT NULL, content TEXT NOT NULL)");
  db.exec("CREATE INDEX items_scope ON items (scope)");
  const insert = db.prepare("INSERT INTO items (id, scope, content) VALUES (?, ?, ?)");
  db.exec("BEGIN");
  for (let n = 0; n < size; n++) {
    const it = backgroundItem(n, size, hits);
    insert.run(it.id, it.scope, it.content as string);
  }
  db.exec("COMMIT");
  const scopes = Array.from({ length: scopeCount(size) }, (_, k) => backgroundScope(k));
  const select = db.prepare(
    `SELECT id, scope, content FROM items WHERE scope IN (${scopes.map(() => "?").join(", ")}) AND content LIKE ?`,
  );
  return {
    call(op: BaselineOp) {
      return (n: number) => {
        if (op === "sqlite-write") {
          insert.run(itemId(0x200, n), "person:bench", `note ${n}`);
        } else {
          const rows = select.all(...scopes, `%${NEEDLE}%`);
          if (rows.length !== hits) throw new Error(`sqlite-read returned ${rows.length} rows`);
        }
      };
    },
    close: () => db.close(),
  };
}

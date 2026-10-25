// Acceptance for card E1.3 (layer 3, replay): the item set rebuilt from the
// event log alone at any seq equals the live projection observed right after
// that event was appended, on a fixture workload and on seeded random ones.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { Db } from "../../src/db/db.ts";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { appendEvent, currentItems, type EventInput } from "../../src/events.ts";
import { itemsAt } from "../../src/replay.ts";
import type { MemoryItem } from "../../src/schema.ts";
import { arbEventInput, arbId, seedFor } from "../generators.ts";

const id = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;

function item(n: number, over: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: id(n),
    class: "episodic",
    scope: "person:omar",
    owner: "person:omar",
    content: `observation ${n}`,
    provenance: {
      kind: "tool",
      ref: "tool/3",
      hash: `sha256:${"ef".repeat(32)}`,
      actor: "agent:pi",
    },
    confidence: 0.8,
    valid_from: "2026-10-25T09:00:00Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: { adapter: "fake", key: id(n) },
    schema_version: 0,
    ...over,
  } as MemoryItem;
}

const base = (n: number) => ({
  id: id(100 + n),
  ts: `2026-10-25T09:${String(n).padStart(2, "0")}:00Z`,
  actor: "agent:pi",
  reason: "fixture",
  schema_version: 0 as const,
});

/**
 * A workload touching every op the projection reacts to: writes, a denied
 * write, an update to a new version with lineage, a promotion, a retirement,
 * a denied eviction, a retirement of an unknown item, and events that change
 * nothing (read, lint, gate, bypass_blocked).
 */
const WORKLOAD: EventInput[] = [
  {
    ...base(0),
    op: "write",
    item_id: id(1),
    scope_from: null,
    scope_to: "person:omar",
    decision: "allow",
    policy_id: "p/write",
    item: item(1),
  },
  {
    ...base(1),
    op: "write",
    item_id: id(2),
    scope_from: null,
    scope_to: "person:omar",
    decision: "allow",
    policy_id: "p/write",
    item: item(2),
  },
  {
    ...base(2),
    op: "write",
    item_id: id(3),
    scope_from: null,
    scope_to: "org",
    decision: "deny",
    policy_id: "p/write",
    item: null,
  },
  {
    ...base(3),
    op: "read",
    item_id: null,
    scope_from: "person:omar",
    scope_to: null,
    decision: "allow",
    policy_id: "p/read",
  },
  {
    ...base(4),
    op: "update",
    item_id: id(4),
    scope_from: null,
    scope_to: "person:omar",
    decision: "allow",
    policy_id: "p/write",
    item: item(4, { version: 2, lineage: [id(1)], content: "observation 1, corrected" }),
  },
  {
    ...base(5),
    op: "retire",
    item_id: id(1),
    scope_from: "person:omar",
    scope_to: null,
    decision: "allow",
    policy_id: "p/retire",
  },
  {
    ...base(6),
    op: "promote",
    item_id: id(2),
    scope_from: "person:omar",
    scope_to: "team:platform",
    decision: "allow",
    policy_id: "p/promote",
    item: item(2, { class: "semantic", scope: "team:platform" }),
  },
  {
    ...base(7),
    op: "evict",
    item_id: id(4),
    scope_from: "person:omar",
    scope_to: null,
    decision: "deny",
    policy_id: "p/retention",
  },
  {
    ...base(8),
    op: "lint",
    item_id: id(4),
    scope_from: "person:omar",
    scope_to: null,
    decision: "allow",
    policy_id: "p/lint",
  },
  {
    ...base(9),
    op: "retire",
    item_id: id(9),
    scope_from: "person:omar",
    scope_to: null,
    decision: "allow",
    policy_id: "p/retire",
  },
  {
    ...base(10),
    op: "gate",
    item_id: id(4),
    scope_from: "person:omar",
    scope_to: "org",
    decision: "ask",
    policy_id: "p/gate",
  },
  {
    ...base(11),
    op: "bypass_blocked",
    item_id: null,
    scope_from: null,
    scope_to: null,
    decision: "deny",
    policy_id: "p/bypass",
  },
  {
    ...base(12),
    op: "evict",
    item_id: id(4),
    scope_from: "person:omar",
    scope_to: null,
    decision: "allow",
    policy_id: "p/retention",
  },
];

/** Appends each event and returns the live projection observed after each one, by seq. */
function appendObserving(db: Db, events: EventInput[]): MemoryItem[][] {
  return events.map((e) => {
    appendEvent(db, e);
    return currentItems(db);
  });
}

describe("itemsAt", () => {
  test("the fixture workload: rebuilt set equals live set at every seq", () => {
    const db = openSqlite(":memory:");
    migrate(db);
    const live = appendObserving(db, WORKLOAD);
    expect(itemsAt(db, -1)).toEqual([]);
    live.forEach((set, seq) => {
      expect(itemsAt(db, seq), `seq ${seq}`).toEqual(set);
    });
    // The fixture exercises every change: the final set differs from every earlier one.
    expect(new Set(live.map((s) => JSON.stringify(s))).size).toBeGreaterThan(5);
    db.close();
  });

  test("rebuilds from the event log alone, without the item projection", () => {
    const db = openSqlite(":memory:");
    migrate(db);
    const live = appendObserving(db, WORKLOAD);
    db.exec("DELETE FROM items");
    live.forEach((set, seq) => {
      expect(itemsAt(db, seq), `seq ${seq}`).toEqual(set);
    });
    db.close();
  });

  test("a seq past the end of the log is the current set", () => {
    const db = openSqlite(":memory:");
    migrate(db);
    const live = appendObserving(db, WORKLOAD);
    expect(itemsAt(db, WORKLOAD.length + 10)).toEqual(live.at(-1));
    db.close();
  });

  const NAME =
    "rebuilt-at-seq equals the incremental state after each append, for any event sequence";
  test(NAME, () => {
    const sequences = fc
      .uniqueArray(arbId, { minLength: 1, maxLength: 4 })
      .chain((ids) => fc.array(arbEventInput(ids), { maxLength: 25 }));
    fc.assert(
      fc.property(sequences, (events) => {
        const db = openSqlite(":memory:");
        migrate(db);
        const live = appendObserving(
          db,
          events.map((e, i) => ({
            ...e,
            id: `${e.id.slice(0, 24)}${String(i).padStart(12, "0")}`,
          })),
        );
        live.forEach((set, seq) => {
          expect(itemsAt(db, seq), `seq ${seq}`).toEqual(set);
        });
        db.close();
      }),
      { numRuns: 300, seed: seedFor(NAME) },
    );
  });
});

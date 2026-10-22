// The Plane interface (docs/architecture.md, "Interfaces"). Every read and
// write to a store crosses it (AGENTS.md rule 2). Only `write`, `read` and
// `events` are declared so far; promote, lint, simulate, distill and explain
// arrive with their cards.
//
// `createStubPlane` admits everything. It exists so the invariants file
// (test/property/invariants.test.ts) has something to fail against until the
// policy engine lands (card E2.1, issue #1). Do not use it anywhere else.
import type { Db } from "./db/db.ts";
import { allEvents, appendEvent, currentItems } from "./events.ts";
import type { Explanation, MemoryEvent, MemoryItem, Policy, ScopeLevel } from "./schema.ts";

/** Who is asking, and in which capacity. */
export interface Actor {
  id: string;
  /** The level the actor reads as: the calling context. */
  level: ScopeLevel;
  /** Scopes the actor belongs to, such as `person:omar` or `team:platform`. */
  memberships: string[];
}

export interface ReadQuery {
  text?: string;
  /** The time validity windows and grant expiry are evaluated at; injected, never read from a clock. */
  at: string;
}

export interface WriteResult {
  /** The item as stored, or null when the write was denied. */
  item: MemoryItem | null;
  event: MemoryEvent;
}

export interface ReadResult {
  items: MemoryItem[];
  explanations: Explanation[];
  /** How many candidate items the filter removed. */
  filtered: number;
  event: MemoryEvent;
}

export interface Plane {
  write(actor: Actor, item: MemoryItem, at: string): WriteResult;
  read(actor: Actor, query: ReadQuery): ReadResult;
  /** The event log, in sequence order. */
  events(): MemoryEvent[];
}

export interface StubPlaneDeps {
  db: Db;
  policy: Policy;
  /** UUIDv7 generator for event ids, injected so core stays free of clocks and randomness. */
  newId: () => string;
}

export function createStubPlane({ db, newId }: StubPlaneDeps): Plane {
  const STUB = { reason: "the stub plane admits everything", policy_id: "stub.admit-all" };
  return {
    write(actor, item, at) {
      const event = appendEvent(db, {
        id: newId(),
        ts: at,
        op: "write",
        item_id: item.id,
        actor: actor.id,
        scope_from: null,
        scope_to: item.scope,
        decision: "allow",
        ...STUB,
        item,
        schema_version: 0,
      });
      return { item, event };
    },
    read(actor, query) {
      const items = currentItems(db);
      const event = appendEvent(db, {
        id: newId(),
        ts: query.at,
        op: "read",
        item_id: null,
        actor: actor.id,
        scope_from: null,
        scope_to: null,
        decision: "allow",
        ...STUB,
        schema_version: 0,
      });
      return { items, explanations: [], filtered: 0, event };
    },
    events: () => allEvents(db),
  };
}

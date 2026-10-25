// Shared fixtures for the Plane integration tests: a fresh in-memory log over
// the fake adapter, deterministic ids, and an item builder.
import { createFakeAdapter, type FakeAdapterOptions } from "@engram/adapters";
import type { Adapter, StoreRef } from "../../../src/adapter.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { openSqlite } from "../../../src/db/sqlite.ts";
import { createPlane } from "../../../src/plane.ts";
import type { MemoryItem, Policy, Provenance } from "../../../src/schema.ts";

export const AT = "2026-10-25T12:00:00Z";

export const id = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;

export function item(
  n: number,
  over: Partial<MemoryItem> & { kind?: Provenance["kind"] } = {},
): MemoryItem {
  const { kind = "user", ...rest } = over;
  return {
    id: id(n),
    class: "semantic",
    scope: "team:platform",
    owner: "person:omar",
    content: `fact number ${n}`,
    provenance: { kind, ref: "doc/1", hash: `sha256:${"0".repeat(64)}`, actor: "person:omar" },
    confidence: 0.9,
    valid_from: "2026-10-01T00:00:00Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 0,
    ...rest,
  } as MemoryItem;
}

export function testPolicy(over: Partial<Policy> = {}): Policy {
  const rule = (scope: Policy["write"][number]["scope"]) => ({
    scope,
    allowed_sources: ["user" as const, "document" as const, "model" as const],
    confidence_floor: 0.5,
    forbidden_classes: ["episodic" as const],
    requires_review: scope === "org",
  });
  return {
    id: "test",
    version: 1,
    write: [rule("person"), rule("role"), rule("team"), rule("org")],
    read: {
      matrix: [
        { reader: "person", may_read: ["person", "role", "team", "org"] },
        { reader: "team", may_read: ["team", "org"] },
      ],
      honour_grants: true,
    },
    retention: [],
    promotion: {
      episodic_to_semantic: { confirmations: 3, or_review: true },
      procedural: { replay_k: 4, replay_n: 5 },
    },
    lints: { enabled: [], thresholds: {} },
    schema_version: 0,
    ...over,
  };
}

/** What a store write does instead of storing, for fault injection. */
export type WriteFault = (item: MemoryItem, store: Adapter) => Promise<StoreRef>;

/**
 * An adapter that counts the writes it receives and records the scope filter
 * of every search; a fake around a fake, not a mock. Setting `fault` makes
 * later writes run it instead (a fault-injecting store).
 */
export function counting(adapter: Adapter): Adapter & {
  writes: number;
  searches: (readonly string[])[];
  fault: WriteFault | null;
} {
  const wrapped = Object.assign(Object.create(adapter) as Adapter, {
    writes: 0,
    searches: [] as (readonly string[])[],
    fault: null as WriteFault | null,
  });
  wrapped.write = async (it) => {
    wrapped.writes++;
    return wrapped.fault ? wrapped.fault(it, adapter) : adapter.write(it);
  };
  const search = adapter.search?.bind(adapter);
  if (search)
    wrapped.search = async (query, scopes) => {
      wrapped.searches.push([...scopes]);
      return search(query, scopes);
    };
  return wrapped;
}

export function fresh(policy: Policy = testPolicy(), options: FakeAdapterOptions = {}) {
  const db = openSqlite(":memory:");
  migrate(db);
  const adapter = counting(createFakeAdapter(options));
  let n = 0;
  const plane = createPlane({ db, adapter, policy, newId: () => id(900_000 + ++n) });
  return { db, adapter, plane, policy };
}

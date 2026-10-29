// fast-check generators for the contract types. Every generated value parses
// with its Zod schema (checked in test/unit/generators.test.ts). Ids and
// timestamps are generated, never read from the clock.
import fc from "fast-check";
import type { MemoryEvent, MemoryItem, Policy } from "../src/schema.ts";

export const SCOPE_LEVELS = ["person", "role", "team", "org"] as const;
export const CLASSES = ["episodic", "semantic", "procedural"] as const;

const hex = (n: number) => fc.stringMatching(new RegExp(`^[0-9a-f]{${n}}$`));

/** A UUIDv7-shaped id. */
export const arbId = fc
  .tuple(hex(8), hex(4), hex(3), fc.constantFrom("8", "9", "a", "b"), hex(3), hex(12))
  .map(([a, b, c, v, d, e]) => `${a}-${b}-7${c}-${v}${d}-${e}`);

/** Timestamps between 2026-01-01 and 2027-12-31, whole seconds, UTC. */
export const arbTimestamp = fc
  .integer({ min: Date.UTC(2026, 0, 1) / 1000, max: Date.UTC(2027, 11, 31) / 1000 })
  .map((s) => new Date(s * 1000).toISOString().replace(".000Z", "Z"));

export const arbPrincipal = fc.constantFrom(
  "person:omar",
  "person:sara",
  "person:ali",
  "agent:pi",
  "agent:claude-code",
);

export const arbScope = fc.oneof(
  fc.constant("org"),
  fc
    .tuple(fc.constantFrom("person", "role", "team"), fc.constantFrom("a", "b", "c"))
    .map(([level, id]) => `${level}:${id}`),
);

export const arbProvenance = fc.record({
  kind: fc.constantFrom("user", "document", "tool", "model", "import", "compaction"),
  ref: fc.constantFrom("doc/1", "session/2", "tool/3"),
  hash: hex(64).map((h) => `sha256:${h}`),
  actor: arbPrincipal,
});

/**
 * A small pool of store refs, so that generated items collide on a ref: two
 * keys under one adapter and the same key under another (review finding R2-3).
 */
export const STORE_REFS = [
  { adapter: "fake", key: "k1" },
  { adapter: "fake", key: "k2" },
  { adapter: "mem0", key: "k1" },
] as const;

export const arbStoreRef = fc.option(
  fc.constantFrom(...STORE_REFS).map((r) => ({ ...r })),
  { nil: null },
);

export function arbItem(
  id: fc.Arbitrary<string> = arbId,
  storeRef: fc.Arbitrary<MemoryItem["store_ref"]> = fc.constant(null),
): fc.Arbitrary<MemoryItem> {
  return fc
    .record({
      store_ref: storeRef,
      id,
      class: fc.constantFrom(...CLASSES),
      scope: arbScope,
      owner: arbPrincipal,
      text: fc.string({ maxLength: 40 }),
      provenance: arbProvenance,
      confidence: fc.double({ min: 0, max: 1, noNaN: true }),
      valid_from: arbTimestamp,
      version: fc.integer({ min: 1, max: 5 }),
      status: fc.constantFrom("candidate", "active", "retired"),
    })
    .map(({ text, ...r }) => {
      const base = {
        ...r,
        valid_to: null,
        ttl: null,
        grants: [],
        lineage: [],
        schema_version: 0 as const,
      };
      return r.class === "procedural"
        ? { ...base, class: "procedural" as const, content: { body: text || "step", tools: [] } }
        : { ...base, class: r.class, content: text };
    });
}

/** An event as a caller submits it: everything but the seq the log assigns. */
export type EventInput = Omit<MemoryEvent, "seq">;

/**
 * Events over a small pool of item ids so that writes, updates and retirements
 * collide, and over the small pool of store refs so that several items hold
 * one ref. Allowed writes and updates carry the item they produce; denials,
 * reads and lints carry none.
 */
export function arbEventInput(itemIds: readonly string[]): fc.Arbitrary<EventInput> {
  const itemId = fc.constantFrom(...itemIds);
  const common = {
    id: arbId,
    ts: arbTimestamp,
    actor: arbPrincipal,
    reason: fc.constantFrom("generated", "policy rule"),
    policy_id: fc.constantFrom("p/write", "p/read", "p/retire"),
    schema_version: fc.constant(0 as const),
  };
  const changing = fc
    .record({
      ...common,
      op: fc.constantFrom("write", "update", "promote"),
      decision: fc.constantFrom("allow", "deny"),
      item: itemId.chain((id) => arbItem(fc.constant(id), arbStoreRef)),
    })
    .map(({ item, ...e }) => ({
      ...e,
      item_id: item.id,
      scope_from: null,
      scope_to: item.scope,
      item: e.decision === "allow" ? item : null,
    }));
  const retiring = fc.record({
    ...common,
    op: fc.constantFrom("retire", "evict"),
    decision: fc.constantFrom("allow", "deny"),
    item_id: itemId,
    scope_from: arbScope,
    scope_to: fc.constant(null),
  });
  const observing = fc.record({
    ...common,
    op: fc.constantFrom("read", "lint", "gate", "bypass_blocked"),
    decision: fc.constantFrom("allow", "deny", "ask"),
    item_id: fc.option(itemId, { nil: null }),
    scope_from: fc.option(arbScope, { nil: null }),
    scope_to: fc.constant(null),
  });
  return fc.oneof(changing, retiring, observing) as fc.Arbitrary<EventInput>;
}

/** A deterministic seed per test name, so a failing case can be rerun alone. */
export function seedFor(name: string): number {
  let h = 2166136261;
  for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export interface Actor {
  id: string;
  /** The level the actor reads as (the calling context). */
  level: (typeof SCOPE_LEVELS)[number];
  /** Scopes the actor belongs to. */
  memberships: string[];
}

export const arbActor: fc.Arbitrary<Actor> = fc
  .record({
    id: arbPrincipal,
    level: fc.constantFrom(...SCOPE_LEVELS),
    memberships: fc.uniqueArray(arbScope, { maxLength: 4 }),
  })
  .map((a) => a);

export const arbGrant = fc.record(
  {
    to: fc.oneof(arbPrincipal, fc.constant("agent:*"), fc.constant("person:*")),
    class: fc.constantFrom(...CLASSES),
    mode: fc.constantFrom("read", "read_write"),
    expires: arbTimestamp,
  },
  { requiredKeys: ["to", "mode"] },
);

/** An item that may carry grants. */
export const arbGrantedItem: fc.Arbitrary<MemoryItem> = fc
  .tuple(arbItem(), fc.array(arbGrant, { maxLength: 2 }))
  .map(([item, grants]) => ({ ...item, grants }));

const arbProvenanceKinds = fc.uniqueArray(
  fc.constantFrom("user", "document", "tool", "model", "import", "compaction"),
  { maxLength: 6 },
);

export const arbPolicy: fc.Arbitrary<Policy> = fc.record({
  id: fc.constantFrom("generated-a", "generated-b"),
  version: fc.constant(1),
  write: fc.uniqueArray(
    fc.record({
      scope: fc.constantFrom(...SCOPE_LEVELS),
      allowed_sources: arbProvenanceKinds,
      confidence_floor: fc.double({ min: 0, max: 1, noNaN: true }),
      forbidden_classes: fc.uniqueArray(fc.constantFrom(...CLASSES), { maxLength: 3 }),
      requires_review: fc.boolean(),
    }),
    { selector: (r) => r.scope, maxLength: 4 },
  ),
  read: fc.record({
    matrix: fc.uniqueArray(
      fc.record({
        reader: fc.constantFrom(...SCOPE_LEVELS),
        may_read: fc.uniqueArray(fc.constantFrom(...SCOPE_LEVELS), { maxLength: 4 }),
      }),
      { selector: (r) => r.reader, maxLength: 4 },
    ),
    honour_grants: fc.boolean(),
  }),
  retention: fc.constant([]),
  promotion: fc.constant({
    episodic_to_semantic: { confirmations: 3, or_review: true },
    procedural: { replay_k: 4, replay_n: 5 },
  }),
  lints: fc.constant({ enabled: [], thresholds: {} }),
  schema_version: fc.constant(0 as const),
});

/**
 * Instants that collide on purpose: a few whole seconds, each with fractions a
 * millisecond cannot tell apart (.0001, .0009), a nanosecond, and a half
 * second. Drawn for read times, grant expiries and validity bounds, they make
 * the boundaries `expires == at` and `valid_from == at` common rather than
 * rare, and catch a comparison through Date.parse (review findings R5-8, R5-11).
 */
export const arbBoundaryTimestamp = fc
  .tuple(
    fc.constantFrom("2026-10-25T12:00:00", "2026-10-25T12:00:01", "2027-03-01T00:00:00"),
    fc.constantFrom("", ".0001", ".0009", ".000000001", ".5"),
  )
  .map(([whole, fraction]) => `${whole}${fraction}Z`);

/** A timestamp from the wide range or from the colliding pool. */
export const arbInstant = fc.oneof(arbTimestamp, arbBoundaryTimestamp);

/**
 * A grant the write gate accepts (decision D4): to a principal or to a pattern
 * with a non-empty prefix after the colon, with a class and an expiry.
 */
export const arbGatedGrant = fc.record({
  to: fc.oneof(arbPrincipal, fc.constantFrom("agent:claude*", "person:o*", "person:s*")),
  class: fc.constantFrom(...CLASSES),
  mode: fc.constantFrom("read", "read_write"),
  expires: arbInstant,
});

/**
 * An item the write gate can admit apart from its policy: only trusted
 * sources carry grants, and every grant is one the gate accepts. Its validity
 * window starts at an instant from the colliding pool or the wide range.
 */
export const arbGatedItem: fc.Arbitrary<MemoryItem> = fc
  .tuple(arbItem(), fc.array(arbGatedGrant, { maxLength: 2 }), arbInstant)
  .map(([item, grants, valid_from]) => ({
    ...item,
    valid_from,
    grants: ["model", "compaction"].includes(item.provenance.kind) ? [] : grants,
  }));

export type ProvenanceKindName = MemoryItem["provenance"]["kind"];

/** A writing actor, sometimes carrying the source a harness would set (decision D4). */
export const arbWriter: fc.Arbitrary<Actor & { source?: ProvenanceKindName }> = fc.record(
  {
    id: arbPrincipal,
    level: fc.constantFrom(...SCOPE_LEVELS),
    memberships: fc.uniqueArray(arbScope, { maxLength: 4 }),
    source: fc.constantFrom<ProvenanceKindName>(
      "user",
      "document",
      "tool",
      "model",
      "import",
      "compaction",
    ),
  },
  { requiredKeys: ["id", "level", "memberships"] },
);

// fast-check generators for the contract types. Every generated value parses
// with its Zod schema (checked in test/unit/generators.test.ts). Ids and
// timestamps are generated, never read from the clock.
import fc from "fast-check";
import type { MemoryEvent, MemoryItem } from "../src/schema.ts";

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

export function arbItem(id: fc.Arbitrary<string> = arbId): fc.Arbitrary<MemoryItem> {
  return fc
    .record({
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
        store_ref: null,
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
 * collide. Allowed writes and updates carry the item they produce; denials,
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
      item: itemId.chain((id) => arbItem(fc.constant(id))),
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

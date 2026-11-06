// The projection rule on its own (review finding R2-1). The stored projection
// and replay both fold applyEvent, so replay equality cannot catch a wrong
// rule; these tests state the rule directly, one case per branch.
import { describe, expect, test } from "vitest";
import { applyEvent } from "../../src/events.ts";
import type { MemoryEvent, MemoryItem } from "../../src/schema.ts";

const ID = "01920000-0000-7000-8000-000000000001";

const ITEM: MemoryItem = {
  id: ID,
  class: "semantic",
  scope: "team:platform",
  owner: "person:omar",
  content: "Deploys happen on Tuesdays.",
  provenance: {
    kind: "user",
    ref: "doc/1",
    hash: `sha256:${"ab".repeat(32)}`,
    actor: "person:omar",
  },
  confidence: 0.9,
  valid_from: "2026-10-25T09:00:00Z",
  valid_to: null,
  ttl: null,
  grants: [],
  version: 1,
  lineage: [],
  status: "active",
  store_ref: { adapter: "fake", key: "k1" },
  schema_version: 1,
};

const NEXT: MemoryItem = { ...ITEM, content: "Deploys happen on Wednesdays.", version: 2 };

function event(op: MemoryEvent["op"], decision: MemoryEvent["decision"], item?: MemoryItem) {
  return {
    seq: 0,
    id: "01920000-0000-7000-8000-000000000100",
    ts: "2026-10-25T09:00:00Z",
    op,
    item_id: ID,
    actor: "agent:pi",
    scope_from: null,
    scope_to: "team:platform",
    decision,
    reason: "unit",
    policy_id: "p/unit",
    item: item ?? null,
    schema_version: 1,
  } satisfies MemoryEvent;
}

const CHANGING = ["write", "update", "promote"] as const;
const RETIRING = ["retire", "evict"] as const;
const OBSERVING = ["read", "lint", "gate", "bypass_blocked"] as const;

describe("applyEvent", () => {
  for (const op of CHANGING) {
    test(`an allowed ${op} replaces the item with the one the event carries`, () => {
      expect(applyEvent(ITEM, event(op, "allow", NEXT))).toBe(NEXT);
      expect(applyEvent(undefined, event(op, "allow", NEXT))).toBe(NEXT);
    });

    for (const decision of ["deny", "ask"] as const) {
      test(`a ${decision} ${op} carrying an item leaves the state as it was`, () => {
        expect(applyEvent(ITEM, event(op, decision, NEXT))).toBe(ITEM);
        expect(applyEvent(undefined, event(op, decision, NEXT))).toBeUndefined();
      });
    }
  }

  for (const op of RETIRING) {
    test(`an allowed ${op} of a known item retires it and changes nothing else`, () => {
      const before = { ...ITEM };
      expect(applyEvent(before, event(op, "allow"))).toEqual({ ...ITEM, status: "retired" });
      expect(before).toEqual(ITEM);
    });

    test(`an allowed ${op} of an unknown item yields no item`, () => {
      expect(applyEvent(undefined, event(op, "allow"))).toBeUndefined();
    });

    for (const decision of ["deny", "ask"] as const) {
      test(`a ${decision} ${op} leaves the item active`, () => {
        expect(applyEvent(ITEM, event(op, decision))).toBe(ITEM);
      });
    }
  }

  for (const op of OBSERVING) {
    test(`an allowed ${op} never changes the item, even one carrying an item`, () => {
      expect(applyEvent(ITEM, event(op, "allow", NEXT))).toBe(ITEM);
      expect(applyEvent(undefined, event(op, "allow"))).toBeUndefined();
    });
  }
});

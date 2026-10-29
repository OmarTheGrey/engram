// Unit tests for the pure retention evaluator (card E2.4, ADR 0025): expiry
// retires, a budget overage evicts in the rule's order (recency, utility,
// manual), and the policy id names the rule. Nothing here touches a log or a
// store; the plane's use of it is tested in test/unit/plane/retention.test.ts.
import { describe, expect, test } from "vitest";
import {
  evaluateRetention,
  ITEM_TTL_ID,
  isExpired,
  itemExpiry,
  type RetentionUsage,
} from "../../../src/policy/retention.ts";
import type { MemoryItem, Policy } from "../../../src/schema.ts";

const AT = "2026-10-25T12:00:00Z";
const id = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;

function item(n: number, over: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: id(n),
    class: "semantic",
    scope: "person:omar",
    owner: "person:omar",
    content: `fact ${n}`,
    provenance: { kind: "user", ref: "doc/1", hash: `sha256:${"0".repeat(64)}`, actor: "x" },
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
    ...over,
  } as MemoryItem;
}

type Rule = Policy["retention"][number];
const rule = (over: Partial<Rule> = {}): Rule => ({
  scope: "person",
  class: "semantic",
  ttl: null,
  budget: null,
  eviction: "recency",
  ...over,
});

function policy(retention: Rule[]): Policy {
  return {
    id: "p",
    version: 1,
    write: [],
    read: { matrix: [], honour_grants: false },
    retention,
    promotion: {
      episodic_to_semantic: { confirmations: 3, or_review: true },
      procedural: { replay_k: 4, replay_n: 5 },
    },
    lints: { enabled: [], thresholds: {} },
    schema_version: 0,
  };
}

/** Usage where item n last changed at seq `seq[n]` and was returned `reads[n]` times. */
const usage = (
  seq: Record<number, number>,
  reads: Record<number, number> = {},
): RetentionUsage => ({
  lastChanged: new Map(Object.entries(seq).map(([n, s]) => [id(Number(n)), s])),
  reads: new Map(Object.entries(reads).map(([n, r]) => [id(Number(n)), r])),
});

describe("expiry", () => {
  const ttlRule = policy([rule({ ttl: 3600 })]);

  test("an item is expired exactly when valid_from plus ttl is not after the time", () => {
    const it = item(1, { valid_from: "2026-10-25T11:00:00.0001Z" });
    expect(itemExpiry(ttlRule, it)?.at).toBe("2026-10-25T12:00:00.0001Z");
    expect(isExpired(ttlRule, it, "2026-10-25T12:00:00Z")).toBe(false);
    // A millisecond-truncating compare would call this equal and expire it early.
    expect(isExpired(ttlRule, it, "2026-10-25T12:00:00.00009Z")).toBe(false);
    expect(isExpired(ttlRule, it, "2026-10-25T12:00:00.0001Z")).toBe(true);
    expect(isExpired(ttlRule, it, "2026-10-25T12:00:00.0002Z")).toBe(true);
  });

  test("the tighter of the rule's ttl and the item's own ttl applies, and names its source", () => {
    const own = item(1, { ttl: 60 });
    expect(itemExpiry(ttlRule, own)).toMatchObject({ ttl: 60, policy_id: ITEM_TTL_ID });
    expect(itemExpiry(ttlRule, item(1, { ttl: 7200 }))).toMatchObject({
      ttl: 3600,
      policy_id: "p/retention/person/semantic",
    });
    expect(itemExpiry(policy([]), own)).toMatchObject({ ttl: 60, policy_id: ITEM_TTL_ID });
    expect(itemExpiry(policy([]), item(1))).toBeNull();
    // A rule for another class or level does not apply.
    expect(itemExpiry(policy([rule({ ttl: 1, class: "episodic" })]), item(1))).toBeNull();
    expect(itemExpiry(policy([rule({ ttl: 1, scope: "team" })]), item(1))).toBeNull();
  });

  test("a ttl past the last representable instant never expires", () => {
    const far = item(1, { ttl: 2 ** 53 - 1 });
    expect(itemExpiry(policy([]), far)).toBeNull();
    expect(isExpired(policy([]), far, "9999-12-31T23:59:59Z")).toBe(false);
  });

  test("the sweep retires expired active and candidate items with op retire", () => {
    const items = [
      item(1, { valid_from: "2026-10-25T10:00:00Z" }),
      item(2, { valid_from: "2026-10-25T11:30:00Z" }),
      item(3, { valid_from: "2026-10-01T00:00:00Z", status: "candidate" }),
      item(4, { valid_from: "2026-10-01T00:00:00Z", status: "retired" }),
    ];
    const out = evaluateRetention(ttlRule, "person:omar", items, AT, usage({}));
    expect(out.map((r) => [r.op, r.item_id, r.decision])).toEqual([
      ["retire", id(1), "allow"],
      ["retire", id(3), "allow"],
    ]);
    expect(out[0]?.policy_id).toBe("p/retention/person/semantic");
    expect(out[0]?.reason).toContain("expired at 2026-10-25T11:00:00Z");
  });

  test("expiry can be left out, as the write path's budget check does", () => {
    const items = [item(1, { valid_from: "2026-10-25T10:00:00Z" })];
    expect(
      evaluateRetention(ttlRule, "person:omar", items, AT, usage({}), { expiry: false }),
    ).toEqual([]);
  });
});

describe("budgets", () => {
  const four = [item(1), item(2), item(3), item(4)];
  const seq = { 1: 40, 2: 10, 3: 30, 4: 20 };

  test("recency evicts the items whose last change is oldest", () => {
    const p = policy([rule({ budget: 2, eviction: "recency" })]);
    const out = evaluateRetention(p, "person:omar", four, AT, usage(seq));
    expect(out.map((r) => [r.op, r.item_id])).toEqual([
      ["evict", id(2)],
      ["evict", id(4)],
    ]);
    expect(out.every((r) => r.policy_id === "p/retention/person/semantic")).toBe(true);
    expect(out[0]?.reason).toContain("4 active semantic items, budget 2");
  });

  test("utility evicts the least read, ties broken by recency", () => {
    const p = policy([rule({ budget: 2, eviction: "utility" })]);
    // Item 2 is the oldest but the most read; items 1 and 3 tie on reads, 3 is older.
    const out = evaluateRetention(
      p,
      "person:omar",
      four,
      AT,
      usage(seq, { 1: 1, 2: 9, 3: 1, 4: 0 }),
    );
    expect(out.map((r) => r.item_id)).toEqual([id(4), id(3)]);
    expect(out[0]?.reason).toContain("0 explanation rows");
  });

  test("manual evicts nothing and asks once, naming the overage", () => {
    const p = policy([rule({ budget: 1, eviction: "manual" })]);
    const out = evaluateRetention(p, "person:omar", four, AT, usage(seq));
    expect(out).toEqual([
      {
        op: "evict",
        decision: "ask",
        item_id: null,
        class: "semantic",
        reason: expect.stringContaining("3 over"),
        policy_id: "p/retention/person/semantic",
      },
    ]);
  });

  test("exactly at the budget nothing is evicted; one over evicts one", () => {
    const p = policy([rule({ budget: 4, eviction: "recency" })]);
    expect(evaluateRetention(p, "person:omar", four, AT, usage(seq))).toEqual([]);
    const five = [...four, item(5)];
    const out = evaluateRetention(p, "person:omar", five, AT, usage({ ...seq, 5: 50 }));
    expect(out.map((r) => r.item_id)).toEqual([id(2)]);
  });

  test("only active items of the rule's scope and class count", () => {
    const p = policy([rule({ budget: 1, eviction: "recency" })]);
    const items = [
      item(1),
      item(2, { status: "candidate" }),
      item(3, { status: "retired" }),
      item(4, { scope: "person:sara" }),
      item(5, { class: "episodic" }),
    ];
    expect(evaluateRetention(p, "person:omar", items, AT, usage({}))).toEqual([]);
  });

  test("expired items are retired before the budget is counted", () => {
    const p = policy([rule({ budget: 2, ttl: 3600, eviction: "recency" })]);
    const items = [
      item(1, { valid_from: "2026-10-25T00:00:00Z" }),
      item(2, { valid_from: "2026-10-25T11:30:00Z" }),
      item(3, { valid_from: "2026-10-25T11:30:00Z" }),
    ];
    const out = evaluateRetention(p, "person:omar", items, AT, usage({ 1: 1, 2: 2, 3: 3 }));
    expect(out.map((r) => [r.op, r.item_id])).toEqual([["retire", id(1)]]);
  });

  test("a null budget never evicts, and each class is judged by its own rule", () => {
    const p = policy([
      rule({ budget: null, eviction: "recency" }),
      rule({ class: "episodic", budget: 1, eviction: "recency" }),
    ]);
    const items = [
      item(1),
      item(2),
      item(3, { class: "episodic" }),
      item(4, { class: "episodic" }),
    ];
    const out = evaluateRetention(p, "person:omar", items, AT, usage({ 1: 1, 2: 2, 3: 4, 4: 3 }));
    expect(out.map((r) => [r.item_id, r.policy_id])).toEqual([
      [id(4), "p/retention/person/episodic"],
    ]);
  });

  test("an item with no recorded change counts as oldest; ties fall to the id", () => {
    const p = policy([rule({ budget: 1, eviction: "recency" })]);
    const out = evaluateRetention(
      p,
      "person:omar",
      [item(2), item(1), item(3)],
      AT,
      usage({ 3: 5 }),
    );
    expect(out.map((r) => r.item_id)).toEqual([id(1), id(2)]);
  });
});

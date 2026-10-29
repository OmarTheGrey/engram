// Acceptance tests of retention on the real Plane (card E2.4, ADR 0025): a
// budget exceeded evicts per policy under all three orders, expiry retires
// and is excluded at read before the sweep, retired content is refused to a
// model source and admitted to a user source, and every retirement is an
// event that replay reproduces. Items stay in the store: retire, never delete
// (ADR 0010).
import { describe, expect, test } from "vitest";
import { contentHash } from "../../../src/content-hash.ts";
import { currentItems, rebuild } from "../../../src/events.ts";
import { type Actor, InvalidCallError } from "../../../src/plane.ts";
import { READ_TTL_ID, RETIRED_CONTENT_ID } from "../../../src/policy/evaluate.ts";
import { ITEM_TTL_ID, RETENTION_MEMBERSHIP_ID } from "../../../src/policy/retention.ts";
import { itemsAt } from "../../../src/replay.ts";
import type { MemoryItem, Policy } from "../../../src/schema.ts";
import { AT, fresh, id, item, testPolicy } from "./helpers.ts";

const omar: Actor = {
  id: "person:omar",
  level: "person",
  memberships: ["person:omar", "team:platform"],
};
const user: Actor = { ...omar, source: "user" };
const model: Actor = { ...omar, source: "model" };
const outsider: Actor = { id: "person:eve", level: "person", memberships: ["person:eve"] };

type Rule = Policy["retention"][number];
const budget = (n: number, eviction: Rule["eviction"], over: Partial<Rule> = {}): Rule => ({
  scope: "person",
  class: "semantic",
  ttl: null,
  budget: n,
  eviction,
  ...over,
});

/** Every source admitted in person scope, so only retention and retired content deny. */
const policy = (retention: Rule[]) =>
  testPolicy({
    retention,
    write: [
      {
        scope: "person",
        allowed_sources: ["user", "document", "tool", "model", "import", "compaction"],
        confidence_floor: 0,
        forbidden_classes: [],
        requires_review: false,
      },
    ],
  });

const mine = (n: number, over: Partial<MemoryItem> = {}) =>
  item(n, { scope: "person:omar", ...over });

const statusOf = (db: Parameters<typeof currentItems>[0]) =>
  Object.fromEntries(currentItems(db).map((i) => [i.id, i.status]));

describe("acceptance (card E2.4): budget exceeded evicts per policy; events recorded", () => {
  test("recency: the write that goes over evicts the oldest, in the same call", async () => {
    const { plane, db, adapter } = fresh(policy([budget(2, "recency")]));
    await plane.write(user, mine(1), AT);
    await plane.write(user, mine(2), AT);
    const third = await plane.write(user, mine(3), AT);
    expect(third.event.decision).toBe("allow");
    expect(third.retention.map((e) => [e.op, e.decision, e.item_id])).toEqual([
      ["evict", "allow", id(1)],
    ]);
    expect(third.retention[0]).toMatchObject({
      actor: "person:omar",
      scope_to: "person:omar",
      policy_id: "test/retention/person/semantic",
      ts: AT,
    });
    expect(third.retention[0]?.reason).toContain("3 active semantic items, budget 2");
    expect(statusOf(db)).toEqual({ [id(1)]: "retired", [id(2)]: "active", [id(3)]: "active" });
    // Retired, never deleted: the store still holds the evicted item's bytes.
    expect(await adapter.read({ adapter: "fake", key: id(1) })).toMatchObject({ id: id(1) });
    // The events are in the log in call order and replay to the same state.
    const log = plane.events();
    expect(log.at(-1)).toEqual(third.retention[0]);
    expect(log.at(-2)).toEqual(third.event);
    const state = currentItems(db);
    rebuild(db);
    expect(currentItems(db)).toEqual(state);
    expect(itemsAt(db, log.length - 1)).toEqual(state);
  });

  test("utility: the least read is evicted, ties broken by recency", async () => {
    const { plane, db } = fresh(policy([budget(2, "utility")]));
    await plane.write(user, mine(1, { content: "alpha" }), AT);
    await plane.write(user, mine(2, { content: "beta" }), AT);
    // Item 1, the oldest, is read twice; item 2 never.
    await plane.read(omar, { text: "alpha", at: AT });
    await plane.read(omar, { text: "alpha", at: AT });
    const third = await plane.write(user, mine(3, { content: "gamma" }), AT);
    expect(third.retention.map((e) => e.item_id)).toEqual([id(2)]);
    expect(third.retention[0]?.reason).toContain("0 explanation rows");
    expect(statusOf(db)[id(1)]).toBe("active");
    // With no reads between them, utility falls back to recency: item 1 is older than 3.
    const fourth = await plane.write(user, mine(4, { content: "delta" }), AT);
    expect(fourth.retention.map((e) => e.item_id)).toEqual([id(3)]);
  });

  test("manual: nothing is evicted, one evict event with decision ask names the overage", async () => {
    const { plane, db } = fresh(policy([budget(1, "manual")]));
    await plane.write(user, mine(1), AT);
    const second = await plane.write(user, mine(2), AT);
    expect(second.retention).toHaveLength(1);
    expect(second.retention[0]).toMatchObject({
      op: "evict",
      decision: "ask",
      item_id: null,
      scope_to: "person:omar",
      policy_id: "test/retention/person/semantic",
    });
    expect(second.retention[0]?.reason).toContain("1 over");
    expect(statusOf(db)).toEqual({ [id(1)]: "active", [id(2)]: "active" });
  });

  test("the budget boundary: at the budget nothing is evicted", async () => {
    const { plane } = fresh(policy([budget(2, "recency")]));
    expect((await plane.write(user, mine(1), AT)).retention).toEqual([]);
    expect((await plane.write(user, mine(2), AT)).retention).toEqual([]);
  });

  test("a denied write runs no budget check, and candidates do not count", async () => {
    const { plane } = fresh(policy([budget(1, "recency")]));
    await plane.write(user, mine(1), AT);
    const denied = await plane.write(outsider, mine(2), AT);
    expect(denied.event.decision).toBe("deny");
    expect(denied.retention).toEqual([]);
    const candidate = await plane.write(user, mine(3, { status: "candidate" }), AT);
    expect(candidate.retention).toEqual([]);
  });

  test("the budget check is per class and scope: another class or scope evicts nothing", async () => {
    const { plane } = fresh(policy([budget(1, "recency")]));
    await plane.write(user, mine(1), AT);
    expect((await plane.write(user, mine(2, { class: "episodic" }), AT)).retention).toEqual([]);
  });
});

describe("expiry", () => {
  const ttl = policy([budget(100, "recency", { ttl: 3600 })]);
  const LATE = "2026-10-25T13:00:00Z";

  test("an expired item is excluded at read before any sweep, counted in filtered", async () => {
    const { plane, db } = fresh(ttl);
    await plane.write(user, mine(1, { valid_from: AT }), AT);
    await plane.write(user, mine(2, { valid_from: "2026-10-25T12:30:00Z" }), AT);
    const before = await plane.read(omar, { at: "2026-10-25T12:59:59Z" });
    expect(before.items.map((i) => i.id)).toEqual([id(2), id(1)]);
    const after = await plane.read(omar, { at: LATE });
    expect(after.items.map((i) => i.id)).toEqual([id(2)]);
    expect(after.filtered).toBe(1);
    expect(after.event.reason).toContain("1 past their ttl");
    // Still active: no sweep has run.
    expect(statusOf(db)).toEqual({ [id(1)]: "active", [id(2)]: "active" });
  });

  test("an item's own ttl applies when tighter than the rule's", async () => {
    const { plane } = fresh(ttl);
    await plane.write(user, mine(1, { valid_from: AT, ttl: 60 }), AT);
    const read = await plane.read(omar, { at: "2026-10-25T12:01:00Z" });
    expect(read.items).toEqual([]);
    const report = await plane.retain(omar, "person:omar", "2026-10-25T12:01:00Z");
    expect(report.events[0]?.policy_id).toBe(ITEM_TTL_ID);
  });

  test("retain retires expired items with op retire, then the budget, and reports both", async () => {
    const { plane, db, adapter } = fresh(policy([budget(1, "recency", { ttl: 3600 })]));
    // Under the write path's budget check item 1 is evicted by item 2; item 3
    // lands in another class with no rule.
    await plane.write(user, mine(1, { valid_from: AT }), AT);
    await plane.write(user, mine(2, { valid_from: AT }), AT);
    const report = await plane.retain(omar, "person:omar", LATE);
    expect(report.decision).toBe("allow");
    expect(report.expired).toEqual([id(2)]);
    expect(report.evicted).toEqual([]);
    expect(report.events.map((e) => [e.op, e.item_id, e.policy_id])).toEqual([
      ["retire", id(2), "test/retention/person/semantic"],
    ]);
    expect(report.events[0]?.reason).toContain("expired at 2026-10-25T13:00:00Z");
    expect(statusOf(db)).toEqual({ [id(1)]: "retired", [id(2)]: "retired" });
    expect(await adapter.read({ adapter: "fake", key: id(2) })).toMatchObject({ id: id(2) });
    // A second sweep finds nothing to do and appends nothing.
    const again = await plane.retain(omar, "person:omar", LATE);
    expect(again.events).toEqual([]);
    expect(plane.events().at(-1)).toEqual(report.events[0]);
  });

  test("retain evicts a scope already over budget, as a policy tightened later finds it", async () => {
    const loose = fresh(policy([]));
    for (const n of [1, 2, 3]) await loose.plane.write(user, mine(n), AT);
    const { createPlane } = await import("../../../src/plane.ts");
    const tight = createPlane({
      db: loose.db,
      adapter: loose.adapter,
      policy: policy([budget(1, "recency")]),
      newId: () => id(800_000 + loose.plane.events().length),
    });
    const report = await tight.retain(omar, "person:omar", AT);
    expect(report.evicted).toEqual([id(1), id(2)]);
    expect(report.events.every((e) => e.op === "evict" && e.decision === "allow")).toBe(true);
  });
});

describe("Plane.retain", () => {
  test("a non-member is refused with one deny event and nothing is retired", async () => {
    const { plane, db } = fresh(policy([budget(1, "manual", { ttl: 1 })]));
    await plane.write(user, mine(1, { valid_from: AT }), AT);
    const report = await plane.retain(outsider, "person:omar", "2027-01-01T00:00:00Z");
    expect(report.decision).toBe("deny");
    expect(report.events).toHaveLength(1);
    expect(report.events[0]).toMatchObject({
      op: "retire",
      decision: "deny",
      item_id: null,
      actor: "person:eve",
      scope_to: "person:omar",
      policy_id: RETENTION_MEMBERSHIP_ID,
    });
    expect(statusOf(db)[id(1)]).toBe("active");
  });

  test("an invalid actor, time or scope is refused before the log is touched", async () => {
    const { plane } = fresh();
    const before = plane.events().length;
    await expect(plane.retain({ ...omar, id: "" }, "person:omar", AT)).rejects.toThrow(
      InvalidCallError,
    );
    await expect(plane.retain(omar, "person:omar", "yesterday")).rejects.toThrow(InvalidCallError);
    await expect(plane.retain(omar, "nowhere", AT)).rejects.toThrow(InvalidCallError);
    expect(plane.events()).toHaveLength(before);
  });

  test("runs in the write queue: a retain called during a write sees that write", async () => {
    const { plane, adapter } = fresh(policy([budget(1, "recency")]));
    // Item 1 is past its own ttl: a sweep that ran before the write would
    // retire it, and the write would then find nothing over budget.
    await plane.write(user, mine(1, { ttl: 60 }), AT);
    // A slow store: the second write is still in the store when retain is called.
    let release = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    adapter.fault = async (it, store) => {
      await gate;
      return store.write(it);
    };
    const writing = plane.write(user, mine(2), AT);
    const retaining = plane.retain(omar, "person:omar", AT);
    release();
    const [written, report] = await Promise.all([writing, retaining]);
    // The write's own budget check evicted item 1; retain, queued after it, finds nothing.
    expect(written.retention.map((e) => e.item_id)).toEqual([id(1)]);
    expect(report.events).toEqual([]);
    const ops = plane.events().map((e) => e.op);
    expect(ops.slice(-2)).toEqual(["write", "evict"]);
  });
});

describe("retired content stays out (engram/write/retired-content)", () => {
  async function withRetired() {
    const env = fresh(policy([budget(1, "recency")]));
    await env.plane.write(user, mine(1, { content: "Deploys happen on Tuesdays" }), AT);
    await env.plane.write(user, mine(2, { content: "deploys happen on wednesdays" }), AT);
    expect(statusOf(env.db)[id(1)]).toBe("retired");
    return env;
  }

  test.each(["model", "compaction", "tool"] as const)(
    "a %s source restating retired content is denied, normalised",
    async (source) => {
      const { plane } = await withRetired();
      const { item: stored, event } = await plane.write(
        { ...omar, source },
        mine(3, { content: "  deploys   HAPPEN on tuesdays " }),
        AT,
      );
      expect(stored).toBeNull();
      expect(event).toMatchObject({ decision: "deny", policy_id: RETIRED_CONTENT_ID });
      expect(event.reason).toContain(id(1));
    },
  );

  test.each(["user", "document", "import"] as const)(
    "a %s source may re-admit it",
    async (source) => {
      const { plane } = await withRetired();
      const { event } = await plane.write(
        { ...omar, source },
        mine(3, { content: "Deploys happen on Tuesdays" }),
        AT,
      );
      expect(event.decision).toBe("allow");
    },
  );

  test("only retired items of the same scope count, and different content passes", async () => {
    const { plane } = await withRetired();
    const other = await plane.write(model, mine(3, { content: "deploys happen on mondays" }), AT);
    expect(other.event.decision).toBe("allow");
    // The same text in another scope was never retired there.
    const env = fresh(
      testPolicy({
        retention: [budget(1, "recency", { scope: "team" })],
      }),
    );
    await env.plane.write(user, item(1, { content: "x marks" }), AT);
    await env.plane.write(user, item(2, { content: "y marks" }), AT);
    const elsewhere = await env.plane.write(model, mine(3, { content: "x marks" }), AT);
    expect(elsewhere.event.decision).toBe("allow");
  });

  test("checkWrite gives the same denial without committing it", async () => {
    const { plane } = await withRetired();
    const before = plane.events().length;
    const check = await plane.checkWrite(
      model,
      mine(3, { content: "deploys happen on tuesdays" }),
      AT,
    );
    expect(check).toMatchObject({ decision: "deny", policy_id: RETIRED_CONTENT_ID });
    expect(plane.events()).toHaveLength(before);
  });

  test("the content hash is the shared normalised one", () => {
    expect(contentHash("Deploys  happen\non Tuesdays")).toBe(
      contentHash("deploys happen on tuesdays"),
    );
  });
});

test("a read that excludes an expired item names engram/read/ttl in no explanation", async () => {
  const { plane } = fresh(policy([budget(100, "recency", { ttl: 1 })]));
  await plane.write(user, mine(1, { valid_from: AT }), AT);
  const { explanations } = await plane.read(omar, { at: "2026-10-25T12:00:01Z" });
  expect(explanations).toEqual([]);
  expect(READ_TTL_ID).toBe("engram/read/ttl");
});

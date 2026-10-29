// Retention, fixes of the independent review of PR 4 (findings P4-1 to P4-12,
// card E2.4, ADR 0025's amendments). Each test reproduces the reviewer's
// probe and fails on the code it was written against.
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import { migrate } from "../../../src/db/migrate.ts";
import { openSqlite } from "../../../src/db/sqlite.ts";
import { currentItems } from "../../../src/events.ts";
import { type Actor, adoptStoreItems, createPlane, inWriteQueue } from "../../../src/plane.ts";
import { RETIRED_CONTENT_ID } from "../../../src/policy/evaluate.ts";
import { mayRetireByTtl } from "../../../src/policy/retention.ts";
import type { MemoryItem, Policy } from "../../../src/schema.ts";
import { AT, fresh, id, item, testPolicy } from "./helpers.ts";

const omar: Actor = {
  id: "person:omar",
  level: "person",
  memberships: ["person:omar", "team:platform"],
};
const user: Actor = { ...omar, source: "user" };

type Rule = Policy["retention"][number];
const rule = (over: Partial<Rule>): Rule => ({
  scope: "person",
  class: "semantic",
  ttl: null,
  budget: null,
  eviction: "recency",
  ...over,
});

const ALL = ["user", "document", "tool", "model", "import", "compaction"] as const;
/** Every source admitted at every level, so only retention and retired content deny. */
const open = (retention: Rule[]) =>
  testPolicy({
    retention,
    write: (["person", "role", "team", "org"] as const).map((scope) => ({
      scope,
      allowed_sources: [...ALL],
      confidence_floor: 0,
      forbidden_classes: [],
      requires_review: false,
    })),
  });

const mine = (n: number, over: Partial<MemoryItem> = {}) =>
  item(n, { scope: "person:omar", ...over });
const statusOf = (db: Parameters<typeof currentItems>[0]) =>
  Object.fromEntries(currentItems(db).map((i) => [i.id, i.status]));

describe("P4-1: the write that just landed is never its own budget check's victim", () => {
  test("utility with every old item read: an old item goes, the new one stays and says so", async () => {
    const { plane, db } = fresh(open([rule({ budget: 2, eviction: "utility" })]));
    await plane.write(user, mine(1, { content: "alpha" }), AT);
    await plane.write(user, mine(2, { content: "beta" }), AT);
    await plane.read(omar, { text: "alpha", at: AT });
    await plane.read(omar, { text: "beta", at: AT });
    const third = await plane.write(user, mine(3, { content: "gamma" }), AT);
    // Both old items were read once; the tie falls to recency: item 1.
    expect(third.retention.map((e) => e.item_id)).toEqual([id(1)]);
    expect(statusOf(db)).toEqual({ [id(1)]: "retired", [id(2)]: "active", [id(3)]: "active" });
    expect(third.item?.status).toBe(statusOf(db)[id(3)]);
  });
});

describe("P4-2: expired items not yet swept hold no budget slot", () => {
  test("the write evicts nothing while an expired item is still active", async () => {
    const { plane, db } = fresh(open([rule({ budget: 2, eviction: "utility", ttl: 60 })]));
    // Item 1 is past its ttl at AT, and was read twice before; item 2 is live, read once.
    await plane.write(user, mine(1, { content: "alpha", valid_from: "2026-10-25T11:58:00Z" }), AT);
    await plane.write(user, mine(2, { content: "beta", valid_from: "2026-10-25T11:59:30Z" }), AT);
    for (const text of ["alpha", "alpha", "beta"])
      await plane.read(omar, { text, at: "2026-10-25T11:59:40Z" });
    const third = await plane.write(user, mine(3, { content: "gamma", valid_from: AT }), AT);
    expect(third.retention).toEqual([]);
    // Not retired on the write path either: the read-time exclusion stays visible.
    expect(statusOf(db)).toEqual({ [id(1)]: "active", [id(2)]: "active", [id(3)]: "active" });
  });
});

describe("P4-3: only a retire or evict event makes content retired", () => {
  test("an item written with status retired blocks nobody", async () => {
    const { plane } = fresh(open([]));
    const tool = { ...omar, source: "tool" as const };
    const planted = await plane.write(
      tool,
      item(1, { content: "Deploys freeze on Fridays", status: "retired" }),
      AT,
    );
    expect(planted.event.decision).toBe("allow");
    const other: Actor = { id: "person:sara", level: "team", memberships: ["team:platform"] };
    const later = await plane.write(
      { ...other, source: "tool" },
      item(2, { owner: "person:sara", content: "deploys freeze on fridays" }),
      AT,
    );
    expect(later.event.decision).toBe("allow");
  });

  test("an item retired by an eviction still blocks", async () => {
    const { plane } = fresh(open([rule({ budget: 1, scope: "team" })]));
    await plane.write(user, item(1, { content: "Deploys freeze on Fridays" }), AT);
    await plane.write(user, item(2, { content: "something else" }), AT);
    const restated = await plane.write(
      { ...omar, source: "tool" },
      item(3, { content: "deploys freeze on fridays" }),
      AT,
    );
    expect(restated.event.policy_id).toBe(RETIRED_CONTENT_ID);
  });
});

describe("P4-4: eviction reasons reveal nothing to a writer who cannot read the scope", () => {
  // testPolicy has no read-matrix row for role: a role-level member of
  // team:platform may write there and reads nothing of it.
  const blind: Actor = {
    id: "person:rita",
    level: "role",
    memberships: ["team:platform"],
    source: "user",
  };

  test.each(["recency", "utility"] as const)("%s", async (eviction) => {
    const { plane } = fresh(open([rule({ scope: "team", budget: 1, eviction })]));
    await plane.write(user, item(1), AT);
    const second = await plane.write(blind, item(2, { owner: "person:rita" }), AT);
    expect(second.retention).toHaveLength(1);
    const [evict] = second.retention;
    expect(evict?.reason).not.toContain(id(1));
    expect(evict?.reason).not.toMatch(/seq|explanation rows|holds \d/);
    // A reader of the scope still gets the full reason.
    const third = await plane.write(user, item(3), AT);
    expect(third.retention[0]?.reason).toContain(id(2));
  });
});

describe("P4-6: one actor's clock cannot retire a shared scope by ttl", () => {
  const YEAR_AHEAD = "2027-10-25T12:00:00Z";
  const ttl = open([rule({ scope: "team", ttl: 86_400 }), rule({ ttl: 86_400 })]);

  test("a sweep a year ahead by a session (no user source) retires nothing in team scope", async () => {
    const { plane, db } = fresh(ttl);
    await plane.write(user, item(1, { valid_from: AT }), AT);
    for (const sweeper of [omar, { ...omar, source: "model" as const }]) {
      const report = await plane.retain(sweeper, "team:platform", YEAR_AHEAD);
      expect(report.expired).toEqual([]);
    }
    expect(statusOf(db)[id(1)]).toBe("active");
    // Reads exclude it all the same: nothing leaks.
    expect((await plane.read(omar, { at: YEAR_AHEAD })).items).toEqual([]);
  });

  test("the reviewer's probe in the far future: only a user may retire shared items by ttl", async () => {
    const { plane, db } = fresh(ttl);
    await plane.write(user, item(1, { valid_from: AT }), AT);
    const far = "9999-12-31T00:00:00Z";
    expect((await plane.retain(omar, "team:platform", far)).expired).toEqual([]);
    expect((await plane.retain(user, "team:platform", far)).expired).toEqual([id(1)]);
    expect(statusOf(db)[id(1)]).toBe("retired");
  });

  test("an actor's own person scope follows its own clock", async () => {
    const { plane } = fresh(ttl);
    await plane.write(user, mine(1, { valid_from: AT }), AT);
    expect((await plane.retain(omar, "person:omar", YEAR_AHEAD)).expired).toEqual([id(1)]);
  });
});

describe("P4-8: the write queue refuses to be entered from inside itself", () => {
  test("a nested call rejects, and the queue goes on", async () => {
    const { plane, db } = fresh(open([]));
    const nested = inWriteQueue(db, () => inWriteQueue(db, () => 1));
    await expect(nested).rejects.toThrow(/inside the write queue/);
    const after = await plane.write(user, mine(1), AT);
    expect(after.event.decision).toBe("allow");
  });
});

describe("P4-10: adoption reports the evictions its writes cause", () => {
  test("two store items into a budget of one", async () => {
    const store = createFakeAdapter();
    await store.write(mine(1));
    await store.write(mine(2));
    const db = openSqlite(":memory:");
    migrate(db);
    let n = 0;
    const deps = {
      db,
      adapter: store,
      policy: open([rule({ budget: 1 })]),
      newId: () => id(900_000 + ++n),
    };
    const owner: Actor = { id: "person:omar", level: "person", memberships: ["person:omar"] };
    const report = await adoptStoreItems(deps, owner, "person:omar", AT);
    expect(report.allowed).toBe(2);
    expect(report.evictions.map((e) => [e.op, e.item_id])).toEqual([["evict", id(1)]]);
  });
});

describe("P4-12: a manual overage is asked about once per state", () => {
  test("sweeps repeat no ask until something in the class changes", async () => {
    const { plane } = fresh(open([rule({ budget: 1, eviction: "manual" })]));
    await plane.write(user, mine(1), AT);
    const second = await plane.write(user, mine(2), AT);
    expect(second.retention.map((e) => e.decision)).toEqual(["ask"]);
    expect((await plane.retain(omar, "person:omar", AT)).events).toEqual([]);
    expect((await plane.retain(omar, "person:omar", AT)).events).toEqual([]);
    const third = await plane.write(user, mine(3), AT);
    expect(third.retention.map((e) => e.decision)).toEqual(["ask"]);
    expect(plane.events().filter((e) => e.decision === "ask")).toHaveLength(2);
  });
});

test("P4-1, plane-level: a write's result is the item as it stands after its slot", async () => {
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  const plane = createPlane({
    db,
    adapter: createFakeAdapter(),
    policy: open([rule({ budget: 1, eviction: "utility" })]),
    newId: () => id(900_000 + ++n),
  });
  await plane.write(user, mine(1, { content: "alpha" }), AT);
  await plane.read(omar, { text: "alpha", at: AT });
  const second = await plane.write(user, mine(2, { content: "beta" }), AT);
  expect(second.item?.status).toBe("active");
  expect(second.retention.map((e) => e.item_id)).toEqual([id(1)]);
});

// Verification of the fix pass (findings P4-13 to P4-16).

describe("P4-13: an item's own ttl cannot plant retired content", () => {
  test("the reviewer's ttl:1 plant: the restating write lands", async () => {
    const { plane } = fresh(open([]));
    const tool = { ...omar, source: "tool" as const };
    const planted = await plane.write(
      tool,
      item(1, { content: "Rotate keys monthly", ttl: 1 }),
      AT,
    );
    expect(planted.event.decision).toBe("allow");
    const swept = await plane.retain(user, "team:platform", "2026-10-25T12:00:05Z");
    expect(swept.expired).toEqual([id(1)]);
    const restated = await plane.write(
      tool,
      item(2, { content: "rotate keys monthly" }),
      "2026-10-25T12:00:06Z",
    );
    expect(restated.event.decision).toBe("allow");
  });

  test("a rule's ttl still makes content retired", async () => {
    const { plane } = fresh(open([rule({ scope: "team", ttl: 1 })]));
    await plane.write(user, item(1, { content: "Rotate keys monthly" }), AT);
    await plane.retain(user, "team:platform", "2026-10-25T12:00:05Z");
    const restated = await plane.write(
      { ...omar, source: "tool" },
      item(2, { content: "rotate keys monthly" }),
      "2026-10-25T12:00:06Z",
    );
    expect(restated.event.policy_id).toBe(RETIRED_CONTENT_ID);
  });
});

describe("P4-15: only a person scope is an actor's own", () => {
  test("an actor whose id is a shared scope retires nothing there by ttl", async () => {
    expect(mayRetireByTtl({ id: "team:platform", source: "model" }, "team:platform")).toBe(false);
    expect(mayRetireByTtl({ id: "org" }, "org")).toBe(false);
    expect(mayRetireByTtl({ id: "person:omar" }, "person:omar")).toBe(true);
    const { plane, db } = fresh(open([rule({ scope: "team", ttl: 60 })]));
    await plane.write(user, item(1, { valid_from: AT }), AT);
    const team: Actor = {
      id: "team:platform",
      level: "team",
      memberships: ["team:platform"],
      source: "model",
    };
    const report = await plane.retain(team, "team:platform", "9999-12-31T00:00:00Z");
    expect(report.expired).toEqual([]);
    expect(currentItems(db)[0]?.status).toBe("active");
  });
});

describe("P4-16: the nesting guard refuses only real nesting", () => {
  test("a callback that fires after its slot ended may queue", async () => {
    const { db } = fresh(open([]));
    let later: Promise<number> | undefined;
    await inWriteQueue(db, () => {
      later = new Promise<number>((resolve, reject) => {
        setTimeout(() => {
          inWriteQueue(db, () => 7).then(resolve, reject);
        }, 20);
      });
    });
    await expect(later).resolves.toBe(7);
  });

  test("a call awaited inside its slot is still refused", async () => {
    const { db } = fresh(open([]));
    await expect(
      inWriteQueue(db, async () => {
        await new Promise((r) => setTimeout(r, 5));
        return inWriteQueue(db, () => 1);
      }),
    ).rejects.toThrow(/inside the write queue/);
  });
});

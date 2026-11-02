// Integration tests of Plane.read and Plane.explain on the fake adapter (card
// E2.2): candidates, the scope, matrix and grant filter, the validity window,
// ranking with named components, one explanation per item, one read event.
import { describe, expect, test } from "vitest";
import { rankForRead } from "../../../src/plane/read.ts";
import { type Actor, ExplainDeniedError } from "../../../src/plane.ts";
import { READ_DEFAULT_DENY_ID, READ_STATUS_ID } from "../../../src/policy/evaluate.ts";
import type { MemoryItem } from "../../../src/schema.ts";
import { AT, fresh, id, item, testPolicy } from "./helpers.ts";

const LATER = "2027-01-01T00:00:00Z";

const writer: Actor = {
  id: "person:omar",
  level: "person",
  memberships: ["team:platform", "team:payments", "person:omar", "org"],
};
const platform: Actor = { id: "person:sara", level: "team", memberships: ["team:platform"] };

async function seeded(items: MemoryItem[], options = {}) {
  const env = fresh(undefined, options);
  for (const it of items) {
    const { event } = await env.plane.write(writer, it, AT);
    expect(event.decision, `seed write of ${it.id}`).toBe("allow");
  }
  return env;
}

describe("acceptance (card E2.2)", () => {
  // Decision D5 changed what this acceptance test checks: the reader-facing
  // `filtered` no longer counts items in scopes the reader cannot reach (it
  // would reveal them); the read event, the audit record, still counts them.
  test("a cross-scope read is denied and the explanation lists the filtered-out count", async () => {
    const { plane } = await seeded([
      item(1, { scope: "team:platform" }),
      item(2, { scope: "team:payments" }),
      item(3, { scope: "team:payments" }),
    ]);
    const result = await plane.read(platform, { at: AT });
    expect(result.items.map((i) => i.id)).toEqual([id(1)]);
    expect(result.filtered).toBe(0);
    expect(result.event.reason).toMatch(/2 projected items outside the reader's reach/);
    const explained = await plane.explain(platform, result.event.id);
    expect(explained).toEqual(result.explanations);
    expect(explained.map((e) => e.item_id)).toEqual([id(1)]);
  });
});

describe("Plane.read", () => {
  test("appends exactly one read event, decision allow, under the actor's read rule", async () => {
    const { plane } = await seeded([item(1)]);
    const before = plane.events().length;
    const { event } = await plane.read(platform, { at: AT });
    expect(plane.events().slice(before)).toEqual([event]);
    expect(event).toMatchObject({
      op: "read",
      decision: "allow",
      item_id: null,
      actor: "person:sara",
      policy_id: "test/read/team",
      ts: AT,
    });
  });

  test("explains each item with rank, components, admitting rule, grants and validity", async () => {
    const { plane } = await seeded([item(1, { valid_to: "2027-01-01T00:00:00Z" })]);
    const { explanations } = await plane.read(platform, { at: AT });
    expect(explanations).toHaveLength(1);
    const [e] = explanations;
    expect(e).toMatchObject({
      item_id: id(1),
      rank: 1,
      policy_id: "test/read/team",
      grants_used: [],
      validity: { at: AT, valid_from: "2026-10-01T00:00:00Z", valid_to: "2027-01-01T00:00:00Z" },
      schema_version: 0,
    });
    expect(Object.keys(e?.score.components ?? {}).sort()).toEqual(["confidence", "recency"]);
    const sum = Object.values(e?.score.components ?? {}).reduce((a, b) => a + b, 0);
    expect(e?.score.total).toBeCloseTo(sum, 12);
  });

  test("admits an item through a grant, naming the grant and the grant rule", async () => {
    const granted = item(1, {
      scope: "person:omar",
      grants: [{ to: "person:sara", mode: "read", class: "semantic", expires: LATER }],
    });
    const { plane } = await seeded([granted]);
    const { items, explanations, filtered } = await plane.read(platform, { at: AT });
    expect(items.map((i) => i.id)).toEqual([id(1)]);
    expect(filtered).toBe(0);
    expect(explanations[0]).toMatchObject({
      policy_id: "test/read/grants",
      grants_used: ["grants[0]:person:sara"],
    });
  });

  test("does not admit through an expired grant, and counts the item as filtered", async () => {
    const granted = item(1, {
      scope: "person:omar",
      grants: [
        { to: "person:sara", mode: "read", class: "semantic", expires: "2026-10-25T11:59:59Z" },
      ],
    });
    const { plane } = await seeded([granted]);
    const result = await plane.read(platform, { at: AT });
    expect(result.items).toEqual([]);
    expect(result.filtered).toBe(1);
  });

  test("excludes an item outside its validity window at the query time, and counts it", async () => {
    const { plane } = await seeded([
      item(1),
      item(2, { valid_from: "2026-11-01T00:00:00Z" }),
      item(3, { valid_to: "2026-10-20T00:00:00Z" }),
    ]);
    const result = await plane.read(platform, { at: AT });
    expect(result.items.map((i) => i.id)).toEqual([id(1)]);
    expect(result.filtered).toBe(2);
    expect(result.event.reason).toMatch(/2 outside the validity window/);
  });

  test("an item valid later is returned to a read at that later time", async () => {
    const { plane } = await seeded([item(2, { valid_from: "2026-11-01T00:00:00Z" })]);
    const later = await plane.read(platform, { at: "2026-11-02T00:00:00Z" });
    expect(later.items.map((i) => i.id)).toEqual([id(2)]);
  });

  test("never returns a candidate or retired item, and counts it as filtered (decision D5)", async () => {
    const { plane } = await seeded([item(1), item(2, { status: "candidate" })]);
    const result = await plane.read(platform, { at: AT });
    expect(result.items.map((i) => i.id)).toEqual([id(1)]);
    expect(result.filtered).toBe(1);
    expect(result.event.reason).toMatch(/1 not active/);
    expect(READ_STATUS_ID).toBe("engram/read/status");
  });

  test("ranks by total score, higher first, and breaks ties by item id", async () => {
    const { plane } = await seeded([
      item(1, { confidence: 0.6 }),
      item(2, { confidence: 0.95 }),
      item(3, { confidence: 0.6 }),
    ]);
    const { items, explanations } = await plane.read(platform, { at: AT });
    expect(items.map((i) => i.id)).toEqual([id(2), id(1), id(3)]);
    expect(explanations.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  test("ranks a more recent item above an older one of equal confidence", async () => {
    const { plane } = await seeded([
      item(1, { valid_from: "2026-01-01T00:00:00Z" }),
      item(2, { valid_from: "2026-10-24T00:00:00Z" }),
    ]);
    const { explanations } = await plane.read(platform, { at: AT });
    expect(explanations.map((e) => e.item_id)).toEqual([id(2), id(1)]);
    expect(explanations[0]?.score.components.recency).toBeGreaterThan(
      explanations[1]?.score.components.recency ?? 1,
    );
  });

  test("with text, returns only the items the adapter's search finds, with a relevance component", async () => {
    const { plane } = await seeded([
      item(1, { content: "deploys run on fridays" }),
      item(2, { content: "lunch is at noon" }),
      item(3, { content: "deploys need two approvals", scope: "team:payments" }),
    ]);
    const result = await plane.read(platform, { text: "deploys", at: AT });
    expect(result.items.map((i) => i.id)).toEqual([id(1)]);
    expect(result.filtered).toBe(0);
    expect(result.explanations[0]?.score.components).toHaveProperty("relevance");
  });

  test("with text and a store without search, the plane matches items holding every query term", async () => {
    // PR #25 review, finding P3-1: the plane's own matching is the lexical
    // stores' rule (every term, case-insensitive), not any term (ADR 0009).
    const { plane } = await seeded(
      [
        item(1, { content: "deploys run on fridays" }),
        item(2, { content: "deploys on fridays need a second reviewer" }),
        item(3, { content: "lunch is at noon" }),
      ],
      { search: false },
    );
    const result = await plane.read(platform, { text: "reviewer deploys", at: AT });
    expect(result.items.map((i) => i.id)).toEqual([id(2)]);
    const rel = result.explanations.map((e) => e.score.components.relevance);
    expect(rel).toEqual([1]);
  });

  test("blank text reads like no text", async () => {
    const { plane } = await seeded([item(1), item(2)], { search: false });
    expect((await plane.read(platform, { text: "   ", at: AT })).items).toHaveLength(2);
  });

  test("matches structured content by its JSON text", async () => {
    const { plane } = await seeded([item(1, { content: { owner: "platform-oncall" } })], {
      search: false,
    });
    const { items } = await plane.read(platform, { text: "oncall", at: AT });
    expect(items.map((i) => i.id)).toEqual([id(1)]);
  });
});

describe("Plane.explain", () => {
  test("returns the explanations persisted for that read, in rank order", async () => {
    const { plane } = await seeded([item(1, { confidence: 0.6 }), item(2)]);
    const first = await plane.read(platform, { at: AT });
    await plane.read(writer, { at: AT });
    expect(await plane.explain(platform, first.event.id)).toEqual(first.explanations);
  });

  test("returns no explanations for a read that returned nothing", async () => {
    const { plane } = await seeded([item(1, { scope: "team:payments" })]);
    const { event } = await plane.read(platform, { at: AT });
    expect(await plane.explain(platform, event.id)).toEqual([]);
  });

  test("rejects an id that names no read event", async () => {
    const { plane } = await seeded([item(1)]);
    const write = plane.events()[0];
    await expect(plane.explain(platform, id(123))).rejects.toThrow(/no read event/);
    await expect(plane.explain(platform, write?.id ?? "")).rejects.toThrow(/no read event/);
  });

  test("refuses another actor's read, revealing none of its explanations (finding R5-12)", async () => {
    const { plane } = await seeded([item(1)]);
    const { event } = await plane.read(platform, { at: AT });
    const ali: Actor = { id: "person:ali", level: "team", memberships: ["team:platform"] };
    const before = plane.events().length;
    await expect(plane.explain(ali, event.id)).rejects.toThrow(ExplainDeniedError);
    await expect(plane.explain(ali, event.id)).rejects.toThrow(/made by another actor/);
    expect(plane.events()).toHaveLength(before);
  });
});

describe("Plane.read reveals nothing about items the reader cannot reach (decision D5)", () => {
  const hidden = (n: number, content: string) =>
    item(n, { scope: "team:payments", content, confidence: 0.99 });

  test("searches the store only in the reader's readable scopes; granted items are matched by the plane (R5-1, N1)", async () => {
    const { plane, adapter } = await seeded([
      item(1, { content: "deploys" }),
      item(2, { scope: "team:payments", content: "deploys" }),
      item(3, {
        scope: "person:omar",
        content: "deploys",
        grants: [{ to: "person:sara", mode: "read", class: "semantic", expires: LATER }],
      }),
    ]);
    const { items } = await plane.read(platform, { text: "deploys", at: AT });
    expect(adapter.searches).toEqual([["team:platform"]]);
    expect(items.map((i) => i.id).sort()).toEqual([id(1), id(3)]);
  });

  test("a grant expired or of another class reaches no item through the plane's matching (D5, N5)", async () => {
    const { plane, adapter } = await seeded([
      item(1, {
        scope: "person:omar",
        content: "deploys",
        grants: [{ to: "person:sara", mode: "read", class: "semantic", expires: AT }],
      }),
      item(2, {
        scope: "person:omar",
        content: "deploys",
        grants: [{ to: "person:sara", mode: "read", class: "procedural", expires: LATER }],
      }),
    ]);
    const result = await plane.read(platform, { text: "deploys", at: AT });
    expect(adapter.searches).toEqual([["team:platform"]]);
    expect(result.items).toEqual([]);
    expect(result.filtered).toBe(2);
  });

  test("relevance ranks among admitted items only: hidden hits do not lower it", async () => {
    const visible = [item(1, { content: "deploys run on fridays" })];
    const alone = await seeded(visible);
    const crowded = await seeded([
      hidden(2, "deploys deploys"),
      hidden(3, "deploys twice"),
      ...visible,
    ]);
    const a = await alone.plane.read(platform, { text: "deploys", at: AT });
    const b = await crowded.plane.read(platform, { text: "deploys", at: AT });
    expect(a.explanations[0]?.score.components.relevance).toBe(1);
    expect(b.explanations).toEqual(a.explanations);
    expect(b.filtered).toBe(a.filtered);
  });

  test("hidden items in a granted item's scope do not change ranks or scores", async () => {
    const granted = item(1, {
      scope: "person:omar",
      content: "deploys need approvals",
      grants: [{ to: "person:sara", mode: "read", class: "semantic", expires: LATER }],
    });
    const privateOne = item(2, { scope: "person:omar", content: "deploys secret" });
    const alone = await seeded([granted]);
    const crowded = await seeded([privateOne, granted]);
    const a = await alone.plane.read(platform, { text: "deploys", at: AT });
    const b = await crowded.plane.read(platform, { text: "deploys", at: AT });
    expect(b.items.map((i) => i.id)).toEqual([id(1)]);
    expect(b.explanations).toEqual(a.explanations);
    expect(b.filtered).toBe(0);
  });

  test("filtered counts items the reader could reach but that fail validity, status or a grant's terms", async () => {
    const { plane } = await seeded([
      item(1, { valid_from: "2026-11-01T00:00:00Z" }),
      item(2, { status: "candidate" }),
      item(3, {
        scope: "person:omar",
        grants: [{ to: "person:sara", mode: "read", class: "procedural", expires: LATER }],
      }),
      hidden(4, "anything"),
      item(5, { scope: "person:omar" }),
    ]);
    const result = await plane.read(platform, { at: AT });
    expect(result.items).toEqual([]);
    expect(result.filtered).toBe(3);
    expect(result.event.reason).toMatch(/2 projected items outside the reader's reach/);
  });

  test("the read event, the audit record, keeps the full counts", async () => {
    const { plane } = await seeded([item(1), hidden(2, "x"), hidden(3, "y")]);
    const { event } = await plane.read(platform, { at: AT });
    expect(event.reason).toMatch(/returned 1 of 1 candidates; 0 filtered/);
    expect(event.reason).toMatch(/2 projected items outside the reader's reach/);
  });

  test("a reader level with no matrix row reads under the default-deny id", async () => {
    const { plane } = await seeded([item(1)]);
    const orgReader: Actor = { id: "person:sara", level: "org", memberships: ["team:platform"] };
    const { items, event } = await plane.read(orgReader, { at: AT });
    expect(items).toEqual([]);
    expect(event.policy_id).toBe(READ_DEFAULT_DENY_ID);
    expect(testPolicy().read.matrix.some((r) => r.reader === "org")).toBe(false);
  });
});

describe("one retrieval and one ordering rule for every reader (PR #25 review, P3-1 and P3-11)", () => {
  const granted = (n: number, content: string) =>
    item(n, {
      scope: "person:omar",
      content,
      grants: [{ to: "person:sara", mode: "read", class: "semantic", expires: LATER }],
    });

  test("an item reached only through a grant is a candidate only when it holds every query term, as the store's search would find it", async () => {
    const { plane, adapter } = await seeded([
      item(1, { content: "what is the deploy schedule" }),
      granted(2, "the schedule moved to friday"),
      granted(3, "what is the schedule for friday"),
    ]);
    const { items } = await plane.read(platform, { text: "what is the schedule", at: AT });
    expect(adapter.searches).toEqual([["team:platform"]]);
    expect(items.map((i) => i.id).sort()).toEqual([id(1), id(3)]);
  });

  test("relevance is each item's share of the query terms, whatever found it, so no other item moves it", async () => {
    // A store whose search returns every item of the scopes asked, as a
    // semantic store may return items lacking some terms: a fake around a fake.
    const env = fresh();
    const inner = env.adapter.search?.bind(env.adapter);
    env.adapter.search = async (_query, scopes) => (inner ? inner("", scopes) : []);
    for (const it of [
      item(1, { content: "deploys run on fridays" }),
      item(2, { content: "deploys need a reviewer" }),
      item(3, { content: "lunch is at noon" }),
    ])
      expect((await env.plane.write(writer, it, AT)).event.decision).toBe("allow");
    const { explanations } = await env.plane.read(platform, { text: "deploys fridays", at: AT });
    const rel = Object.fromEntries(
      explanations.map((e) => [e.item_id, e.score.components.relevance]),
    );
    expect(rel).toEqual({ [id(1)]: 1, [id(2)]: 0.5, [id(3)]: 0 });
    expect(explanations.map((e) => e.item_id)).toEqual([id(1), id(2), id(3)]);
  });

  test("rankForRead orders a set and any subset of it the same way: by score, ties by id", () => {
    const items = [
      item(1, { content: "deploys", confidence: 0.5, valid_from: "2026-10-01T00:00:00Z" }),
      item(2, { content: "deploys fridays", confidence: 0.9, valid_from: "2026-01-01T00:00:00Z" }),
      item(3, { content: "fridays", confidence: 0.9, valid_from: "2026-10-24T00:00:00Z" }),
      item(4, { content: "deploys fridays", confidence: 0.9, valid_from: "2026-01-01T00:00:00Z" }),
    ];
    const all = rankForRead(items, "deploys fridays", AT).map((r) => r.item.id);
    expect(all.indexOf(id(2))).toBeLessThan(all.indexOf(id(4)));
    for (const drop of items) {
      const sub = rankForRead(
        items.filter((i) => i !== drop),
        "deploys fridays",
        AT,
      ).map((r) => r.item.id);
      expect(sub).toEqual(all.filter((x) => x !== drop.id));
    }
    expect(rankForRead(items, undefined, AT)[0]?.components).not.toHaveProperty("relevance");
  });

  test("the plane returns its admitted items in rankForRead's order", async () => {
    const { plane } = await seeded([
      item(1, { content: "deploys", confidence: 0.5 }),
      item(2, { content: "deploys", confidence: 0.9, valid_from: "2026-10-24T00:00:00Z" }),
      granted(3, "deploys"),
    ]);
    const read = await plane.read(platform, { text: "deploys", at: AT });
    const ranked = rankForRead(read.items, "deploys", AT);
    expect(read.items.map((i) => i.id)).toEqual(ranked.map((r) => r.item.id));
    expect(read.explanations.map((e) => e.score.total)).toEqual(ranked.map((r) => r.total));
  });
});

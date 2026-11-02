// The core retrieval pipeline and a plane built with it (PR #25 review round
// 2, R1; ADR 0009, proposed amendment of 2026-11-02): terms with their edge
// punctuation removed, candidates holding any term, each item scored on its
// own, cut to a limit; the plane runs it after its read filter and never
// searches the store.
import { describe, expect, test } from "vitest";
import { currentItems } from "../../../src/events.ts";
import { queryTerms, rankForRead, retrieve, walkToAdmitted } from "../../../src/plane/retrieve.ts";
import { type Actor, createPlane } from "../../../src/plane.ts";
import { evaluateRead } from "../../../src/policy/evaluate.ts";
import { AT, fresh, id, item } from "./helpers.ts";

const LATER = "2027-01-01T00:00:00Z";
const writer: Actor = {
  id: "person:omar",
  level: "person",
  memberships: ["team:platform", "team:payments", "person:omar", "org"],
};
const sara: Actor = { id: "person:sara", level: "team", memberships: ["team:platform"] };

describe("the core retrieval pipeline", () => {
  test("terms are the query's words, lower-cased, without edge punctuation", () => {
    expect(queryTerms("Is the April 17 visit oncology, or infectious disease?")).toEqual([
      "is",
      "the",
      "april",
      "17",
      "visit",
      "oncology",
      "or",
      "infectious",
      "disease",
    ]);
    expect(queryTerms("  ... ?? ")).toEqual([]);
    expect(queryTerms(undefined)).toEqual([]);
    expect(queryTerms("e-mail co-op")).toEqual(["e-mail", "co-op"]);
  });

  test("candidates hold any term; relevance is each item's share; no terms means every item", () => {
    const items = [
      item(1, { content: "deploys run on fridays" }),
      item(2, { content: "deploys need a reviewer" }),
      item(3, { content: "lunch is at noon" }),
    ];
    const ranked = retrieve(items, "Deploys, fridays?", AT);
    expect(ranked.map((r) => r.item.id)).toEqual([id(1), id(2)]);
    expect(ranked.map((r) => r.components.relevance)).toEqual([1, 0.5]);
    expect(retrieve(items, undefined, AT)).toHaveLength(3);
    expect(retrieve(items, undefined, AT)[0]?.components).not.toHaveProperty("relevance");
  });

  test("the limit cuts the ranked list", () => {
    const items = [1, 2, 3, 4].map((n) => item(n, { content: `deploys ${n}` }));
    expect(retrieve(items, "deploys", AT, 2).map((r) => r.item.id)).toEqual([id(1), id(2)]);
    expect(retrieve(items, "deploys", AT, 0)).toEqual([]);
  });

  test("a set and any subset of it are ordered alike: by score, ties by id", () => {
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
  });
});

describe("the walk to the admitted items (C4's read, review round 3, V-2)", () => {
  const items = [
    item(1, { content: "deploys run on fridays", confidence: 0.9 }),
    item(2, { content: "deploys need a reviewer", confidence: 0.8 }),
    item(3, { content: "fridays are quiet", confidence: 0.7 }),
    item(4, { content: "deploys on fridays are frozen", confidence: 0.6 }),
    item(5, { content: "deploys", confidence: 0.5 }),
    item(6, { content: "lunch is at noon" }),
  ];
  const q = "deploys fridays";
  const denied = new Set([id(1), id(3)]);
  const admitted = (i: { id: string }) => !denied.has(i.id);

  test("walks the whole ranking until it has passed as many admitted items as the admitted-only read returns", () => {
    const ranking = retrieve(items, q, AT).map((r) => r.item.id);
    for (const limit of [0, 1, 2, 3, 10]) {
      const walked = walkToAdmitted(items, q, AT, limit, admitted);
      const expected = retrieve(items.filter(admitted), q, AT, limit).map((r) => r.item.id);
      expect(walked.filter((w) => w.admitted).map((w) => w.item.id)).toEqual(expected);
      // A prefix of the whole ranking, ending on an admitted item.
      expect(walked.map((w) => w.item.id)).toEqual(ranking.slice(0, walked.length));
      if (walked.length > 0) expect(walked.at(-1)?.admitted).toBe(true);
      expect(walked.every((w) => w.admitted === admitted(w.item))).toBe(true);
    }
    expect(walkToAdmitted(items, q, AT, 0, admitted)).toEqual([]);
  });

  test("with fewer admitted items than the limit it stops after the last admitted one", () => {
    const one = (i: { id: string }) => i.id === id(2);
    const walked = walkToAdmitted(items, q, AT, 20, one);
    expect(walked.at(-1)?.item.id).toBe(id(2));
    expect(walked.filter((w) => w.admitted)).toHaveLength(1);
    expect(walkToAdmitted(items, q, AT, 20, () => false)).toEqual([]);
  });

  test("without a limit it passes every admitted candidate", () => {
    const walked = walkToAdmitted(items, q, AT, undefined, admitted);
    expect(walked.filter((w) => w.admitted).map((w) => w.item.id)).toEqual(
      retrieve(items.filter(admitted), q, AT).map((r) => r.item.id),
    );
  });
});

describe("a plane built with the core pipeline", () => {
  async function seeded(limit?: number) {
    const env = fresh(undefined);
    const items = [
      item(1, { content: "deploys run on fridays", confidence: 0.6 }),
      item(2, { content: "fridays are quiet", confidence: 0.7 }),
      item(3, { scope: "team:payments", content: "deploys deploys fridays", confidence: 0.99 }),
      item(4, {
        scope: "person:omar",
        content: "the deploy calendar for fridays",
        grants: [{ to: "person:sara", mode: "read", class: "semantic", expires: LATER }],
      }),
      item(5, { content: "lunch is at noon" }),
    ];
    for (const it of items) {
      expect((await env.plane.write(writer, it, AT)).event.decision).toBe("allow");
    }
    let n = 0;
    const plane = createPlane({
      db: env.db,
      adapter: env.adapter,
      policy: env.policy,
      newId: () => id(800_000 + ++n),
      retrieval: { pipeline: "core", ...(limit === undefined ? {} : { limit }) },
    });
    return { env, plane };
  }

  test("returns the pipeline over the items its filter admits, and never searches the store", async () => {
    const { env, plane } = await seeded();
    const read = await plane.read(sara, { text: "Fridays?", at: AT });
    // Item 3 matches best but sara cannot reach it; item 4 she reaches by a grant.
    const admitted = currentItems(env.db).filter(
      (i) => evaluateRead(env.policy, sara, i, AT).admitted,
    );
    const expected = retrieve(admitted, "Fridays?", AT);
    expect(read.items.map((i) => i.id)).toEqual(expected.map((r) => r.item.id));
    expect(read.items.map((i) => i.id).sort()).toEqual([id(1), id(2), id(4)]);
    expect(read.explanations.map((e) => e.score.total)).toEqual(expected.map((r) => r.total));
    expect(env.adapter.searches).toEqual([]);
    expect(read.event.reason).toMatch(/returned 3 of 3 candidates; 0 filtered/);
  });

  test("the limit applies to what the reader reaches: an item outside her reach takes no slot", async () => {
    const { plane } = await seeded(1);
    const read = await plane.read(sara, { text: "deploys fridays", at: AT });
    // Item 3 (payments) would rank first over everything; sara's top one is item 1.
    expect(read.items.map((i) => i.id)).toEqual([id(1)]);
    expect(read.explanations).toHaveLength(1);
  });

  test("the limit applies after the read filter: a reachable item the filter rejects takes no slot", async () => {
    const { env } = await seeded();
    // In sara's own scope and the best match, but its validity window has closed.
    const closed = item(6, {
      content: "deploys deploys fridays fridays",
      confidence: 0.99,
      valid_from: "2026-10-20T00:00:00Z",
      valid_to: "2026-10-24T00:00:00Z",
    });
    expect((await env.plane.write(writer, closed, AT)).event.decision).toBe("allow");
    let n = 0;
    const plane = createPlane({
      db: env.db,
      adapter: env.adapter,
      policy: env.policy,
      newId: () => id(700_000 + ++n),
      retrieval: { pipeline: "core", limit: 1 },
    });
    const own = currentItems(env.db).filter((i) => i.scope === "team:platform");
    expect(retrieve(own, "deploys fridays", AT, 1)[0]?.item.id).toBe(id(6));
    const read = await plane.read(sara, { text: "deploys fridays", at: AT });
    expect(read.items.map((i) => i.id)).toEqual([id(1)]);
    expect(read.event.reason).toMatch(/1 outside the validity window/);
  });

  test("a granted item is a candidate when it holds any query term", async () => {
    const { plane } = await seeded();
    const read = await plane.read(sara, { text: "calendar", at: AT });
    expect(read.items.map((i) => i.id)).toEqual([id(4)]);
    expect(read.explanations[0]?.grants_used).toEqual(["grants[0]:person:sara"]);
  });
});

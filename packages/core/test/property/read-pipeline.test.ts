// A plane built with the core retrieval pipeline (PR #25 review round 2, R1;
// ADR 0009, proposed amendment of 2026-11-02), over generated policies,
// readers, items, queries and limits: what it returns is exactly the
// pipeline run on the items its read filter admits (ranked, then cut), it
// never searches the store, and items the reader cannot reach change nothing
// it returns (decision D5, as read-leak.test.ts checks for the default read).
import { type Adapter, createFakeAdapter } from "@engram/adapters";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { currentItems } from "../../src/events.ts";
import { retrieve } from "../../src/plane/retrieve.ts";
import { type Actor, createPlane } from "../../src/plane.ts";
import { evaluateRead, reachable } from "../../src/policy/evaluate.ts";
import type { MemoryItem, Policy } from "../../src/schema.ts";
import { arbActor, arbGatedItem, arbInstant, arbPolicy, seedFor } from "../generators.ts";
import { item, testPolicy } from "../unit/plane/helpers.ts";

const RUNS = 300;

const ADMIT_ALL = (policy: Policy): Policy => ({
  ...policy,
  id: "admit-all",
  write: (["person", "role", "team", "org"] as const).map((scope) => ({
    scope,
    allowed_sources: ["user", "document", "tool", "model", "import", "compaction", "external"],
    confidence_floor: 0,
    forbidden_classes: [],
    requires_review: false,
  })),
});

const textOf = (i: MemoryItem) =>
  typeof i.content === "string" ? i.content : JSON.stringify(i.content);

async function coreRead(
  policy: Policy,
  stored: MemoryItem[],
  reader: Actor,
  text: string | undefined,
  at: string,
  limit: number | undefined,
) {
  const db = openSqlite(":memory:");
  migrate(db);
  const searched: (readonly string[])[] = [];
  const inner = createFakeAdapter();
  const adapter: Adapter = Object.assign(Object.create(inner) as Adapter, {
    search: async (query: string, scopes: readonly string[]) => {
      searched.push(scopes);
      return inner.search ? inner.search(query, scopes) : [];
    },
  });
  let n = 0;
  const newId = () => `01920000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
  const writer: Actor = {
    id: "person:omar",
    level: "person",
    memberships: [...new Set(stored.map((i) => i.scope))],
  };
  const admitAll = createPlane({ db, adapter, policy: ADMIT_ALL(policy), newId });
  for (const item of stored) await admitAll.write(writer, item, at);
  const plane = createPlane({
    db,
    adapter,
    policy,
    newId,
    retrieval: { pipeline: "core", ...(limit === undefined ? {} : { limit }) },
  });
  const read = await plane.read(reader, { text, at });
  const projection = currentItems(db);
  db.close();
  return { read, searched, projection };
}

const scenario = fc
  .record({
    policy: fc
      .tuple(arbPolicy, fc.nat(3))
      .map(([p, k]) => (k > 0 ? { ...p, read: { ...p.read, honour_grants: true } } : p)),
    reader: arbActor,
    pool: fc.uniqueArray(arbGatedItem, { selector: (i) => i.id, maxLength: 8 }),
    at: arbInstant,
    limit: fc.constantFrom<number | undefined>(undefined, 1, 2, 3),
  })
  .chain((s) =>
    // Readers who belong to some of the pool's scopes, so that reads return items.
    // Half the reads happen after every item became valid, so that the
    // validity window does not filter nearly everything.
    fc
      .tuple(fc.subarray([...new Set(s.pool.map((i) => i.scope))]), fc.boolean())
      .map(([scopes, late]) => ({
        ...s,
        at:
          late && s.pool.length > 0
            ? s.pool.map((i) => i.valid_from).reduce((a, b) => (a > b ? a : b))
            : s.at,
        reader: {
          ...s.reader,
          memberships: [...new Set([...s.reader.memberships, ...scopes])],
        },
      })),
  )
  .chain((s) => {
    const words = s.pool.flatMap((i) => textOf(i).split(/\s+/).filter(Boolean));
    const text: fc.Arbitrary<string | undefined> = fc.oneof(
      fc.constant(undefined),
      words.length > 0
        ? fc
            .tuple(fc.constantFrom(...words), fc.constantFrom(...words))
            .map(([a, b]) => `${a} ${b}?`)
        : fc.constant("nothing"),
    );
    return fc.record({ s: fc.constant(s), text });
  });

describe("a plane built with the core retrieval pipeline", () => {
  const NAME =
    "returns the pipeline over what its filter admits, searches no store, and ignores what the reader cannot reach";
  test(NAME, async () => {
    const seen = { returned: 0, capped: 0, hidden: 0 };
    await fc.assert(
      fc.asyncProperty(scenario, async ({ s, text }) => {
        const { policy, reader, pool, at, limit } = s;
        const { read, searched, projection } = await coreRead(
          policy,
          pool,
          reader,
          text,
          at,
          limit,
        );
        const admitted = projection.filter((i) => evaluateRead(policy, reader, i, at).admitted);
        const expected = retrieve(admitted, text, at, limit);
        expect(read.items.map((i) => i.id)).toEqual(expected.map((r) => r.item.id));
        expect(read.explanations.map((e) => e.score)).toEqual(
          expected.map((r) => ({ total: r.total, components: r.components })),
        );
        expect(searched).toEqual([]);
        if (read.items.length > 0) seen.returned++;
        if (limit !== undefined && retrieve(admitted, text, at).length > limit) seen.capped++;
        // The same read with the unreachable items gone returns the same.
        const visible = pool.filter((i) => reachable(policy, reader, i));
        if (visible.length < pool.length) {
          seen.hidden++;
          const without = await coreRead(policy, visible, reader, text, at, limit);
          expect(without.read.items).toEqual(read.items);
          expect(without.read.explanations).toEqual(read.explanations);
          expect(without.read.filtered).toBe(read.filtered);
        }
      }),
      { numRuns: RUNS, seed: seedFor(NAME) },
    );
    expect(seen.returned, "reads that returned items").toBeGreaterThan(RUNS / 30);
    expect(seen.capped, "reads the limit cut").toBeGreaterThan(0);
    expect(seen.hidden, "reads with unreachable items").toBeGreaterThan(RUNS / 4);
  }, 120_000);

  // Random policies filter most items, so the ranking and the cut are seldom
  // reached above; here every item is active, valid and in a scope the reader
  // reads (or granted to it), under one permissive policy, so they are.
  const DENSE = "ranks and cuts many admitted items exactly as the pipeline does";
  test(DENSE, async () => {
    const policy = testPolicy();
    const reader: Actor = { id: "person:sara", level: "team", memberships: ["team:platform"] };
    const AT_READ = "2026-12-01T00:00:00Z";
    const dense = fc.record({
      pool: fc.uniqueArray(
        fc.tuple(
          fc.nat(999),
          fc.array(fc.constantFrom("deploys", "fridays", "lunch", "noon", "review", "Calendar?"), {
            minLength: 1,
            maxLength: 4,
          }),
          fc.integer({ min: 1, max: 99 }),
          fc.integer({ min: 1, max: 330 }),
          fc.boolean(),
        ),
        { selector: ([n]) => n, minLength: 1, maxLength: 12 },
      ),
      text: fc.oneof(
        fc.constant(undefined),
        fc.constantFrom("deploys", "fridays deploys", "Lunch, noon?", "review calendar", "nothing"),
      ),
      limit: fc.constantFrom<number | undefined>(undefined, 1, 2, 5),
    });
    let capped = 0;
    await fc.assert(
      fc.asyncProperty(dense, async ({ pool, text, limit }) => {
        const stored = pool.map(([n, words, conf, day, granted]) =>
          item(n + 1, {
            content: words.join(" "),
            confidence: conf / 100,
            valid_from: new Date(Date.UTC(2026, 0, day)).toISOString(),
            ...(granted
              ? {
                  scope: "person:omar",
                  grants: [
                    {
                      to: reader.id,
                      mode: "read",
                      class: "semantic",
                      expires: "2099-01-01T00:00:00Z",
                    },
                  ],
                }
              : { scope: "team:platform" }),
          }),
        );
        const { read, projection } = await coreRead(policy, stored, reader, text, AT_READ, limit);
        const admitted = projection.filter(
          (i) => evaluateRead(policy, reader, i, AT_READ).admitted,
        );
        expect(admitted).toHaveLength(stored.length);
        const expected = retrieve(admitted, text, AT_READ, limit);
        expect(read.items.map((i) => i.id)).toEqual(expected.map((r) => r.item.id));
        if (limit !== undefined && retrieve(admitted, text, AT_READ).length > limit) capped++;
      }),
      { numRuns: 200, seed: seedFor(DENSE) },
    );
    expect(capped, "reads the limit cut").toBeGreaterThan(20);
  }, 120_000);
});

// PR #25 review round 2, R1: one retrieval pipeline for every condition,
// defined in core (`retrieve`: candidates holding any query term, each item
// scored on its own, the top READ_LIMIT). C2 to C4 run it over what the store
// lists; C5's plane runs it over what its read filter admits. On every GateMem
// fixture checkpoint and nine queries each:
// - C2's list is the pipeline over every item, on every store H1 might use
//   (fake, files, Letta, Mem0: each lists every item it holds, so none of
//   their native searches is involved);
// - C5's list is the pipeline over the items the plane admits for the asker;
// - without a limit, C5's list is a subset of C2's in C2's order (with one it
//   need not be, by design: the admitted items' top 20 is not the top 20 of
//   everything);
// - the floor: C2 finds memory for a checkpoint's own question about as often
//   as the history holds what the question is about.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Adapter, createFakeAdapter, createFilesAdapter } from "@engram/adapters";
import { gatemem } from "@engram/bench";
import {
  createPlane,
  evaluateRead,
  loadPreset,
  type MemoryItem,
  migrate,
  openSqlite,
  retrieve,
} from "@engram/core";
import { afterAll, describe, expect, test } from "vitest";
import { READ_LIMIT, ungovernedRead } from "../src/conditions.ts";
import { probeInputs, sequentialIds } from "../src/gatemem-probe.ts";
import { closeStore, openStore } from "../src/stores.ts";

const DATA = new URL("../../../fixtures/bench/gatemem/", import.meta.url);
const domains = gatemem.loadDataset(DATA.pathname.replace(/^\/([A-Za-z]:)/, "$1"));
/** The reviewer's queries, the empty one and three topic words; each checkpoint's own question is added. */
const QUERIES = [
  "April 17 visit oncology or infectious disease",
  "appointment",
  "what is the schedule",
  "Linden lesson note",
  "",
  "medication",
  "password",
  "budget",
];
const NO_LIMIT = Number.MAX_SAFE_INTEGER;
const policy = loadPreset("medium");
const temp: string[] = [];
afterAll(() => {
  for (const d of temp) rmSync(d, { recursive: true, force: true });
});

const refOf = (i: Pick<MemoryItem, "provenance">) => i.provenance.ref;
const cases = domains.flatMap((d) =>
  d.checkpoints.map((c) => [c.checkpoint_id, d, [...QUERIES, c.query_text]] as const),
);

/** One checkpoint's items written to a store (C2) and through a core-pipeline plane (C5). */
async function setUp(
  domain: gatemem.Domain,
  checkpointId: string,
  adapter: Adapter,
  limit: number,
) {
  const newId = sequentialIds();
  const { mapped } = probeInputs(domain, checkpointId, newId);
  const store = { adapter, scopes: new Set<string>() };
  const db = openSqlite(":memory:");
  migrate(db);
  const plane = createPlane({
    db,
    adapter: createFakeAdapter(),
    policy,
    newId,
    retrieval: { pipeline: "core", limit },
  });
  for (const { actor, item } of mapped.writes) {
    await store.adapter.write(item);
    store.scopes.add(item.scope);
    expect((await plane.write(actor, item, item.valid_from)).event.decision).toBe("allow");
  }
  const items = mapped.writes.map((w) => w.item);
  const admitted = items.filter((i) => evaluateRead(policy, mapped.asker, i, mapped.at).admitted);
  return {
    mapped,
    items,
    admitted,
    c2: async (q: string) => (await ungovernedRead(store, q, mapped.at, limit)).map(refOf),
    c5: async (q: string) =>
      (await plane.read(mapped.asker, { text: q, at: mapped.at })).items.map(refOf),
    close: () => db.close(),
  };
}

const pipeline = (items: MemoryItem[], q: string, at: string, limit: number) =>
  retrieve(items, q, at, limit).map((r) => refOf(r.item));

describe("one retrieval pipeline for every condition (R1)", () => {
  test.each(cases)(
    "%s: C2 is the pipeline over every item, C5 the pipeline over what the plane admits, at the read limit",
    async (id, domain, queries) => {
      const run = await setUp(domain, id, createFakeAdapter(), READ_LIMIT);
      for (const q of queries) {
        const at = run.mapped.at;
        expect(await run.c2(q), `C2 ${JSON.stringify(q)}`).toEqual(
          pipeline(run.items, q, at, READ_LIMIT),
        );
        expect(await run.c5(q), `C5 ${JSON.stringify(q)}`).toEqual(
          pipeline(run.admitted, q, at, READ_LIMIT),
        );
      }
      run.close();
    },
    60_000,
  );

  test.each(cases)(
    "%s: without a limit, C5's entries are a subset of C2's, in C2's order",
    async (id, domain, queries) => {
      const run = await setUp(domain, id, createFakeAdapter(), NO_LIMIT);
      for (const q of queries) {
        const [c2, c5] = [await run.c2(q), await run.c5(q)];
        const inC5 = new Set(c5);
        expect(
          c2.filter((r) => inC5.has(r)),
          JSON.stringify(q),
        ).toEqual(c5);
      }
      run.close();
    },
    60_000,
  );

  test("with the limit the subset need not hold, by design, and the test sees such a read", async () => {
    let notSubset = 0;
    for (const [id, domain, queries] of cases) {
      const run = await setUp(domain, id, createFakeAdapter(), READ_LIMIT);
      for (const q of queries) {
        const c2 = new Set(await run.c2(q));
        if ((await run.c5(q)).some((r) => !c2.has(r))) notSubset++;
      }
      run.close();
    }
    expect(notSubset).toBeGreaterThan(0);
  }, 300_000);

  // Letta commits once per write and Mem0 embeds each one, so two checkpoints each.
  const two = cases.filter(
    ([id]) => id.includes("ckpt_13") || (id.includes("linden") && id.endsWith("ckpt_01")),
  );
  test.each(["files", "mem0", "letta"] as const)(
    "on %s, C2's list is the same pipeline over what the store lists",
    async (name) => {
      expect(two).toHaveLength(2);
      for (const [id, domain, queries] of two) {
        let adapter: Adapter;
        if (name === "files") {
          const root = mkdtempSync(join(tmpdir(), "engram-x1-files-"));
          temp.push(root);
          adapter = createFilesAdapter({ root, owner: "x1" });
        } else adapter = await openStore(name);
        const run = await setUp(domain, id, adapter, READ_LIMIT);
        for (const q of queries) {
          expect(await run.c2(q), `${name} ${JSON.stringify(q)}`).toEqual(
            pipeline(run.items, q, run.mapped.at, READ_LIMIT),
          );
        }
        run.close();
        if (name !== "files") await closeStore(adapter);
      }
    },
    300_000,
  );
});

describe("the floor: C2 finds memory for a checkpoint's own question (R1)", () => {
  test("about as often as the history holds the leak target or the answer the question is about", async () => {
    let found = 0;
    let located = 0;
    let recalled = 0;
    for (const [id, domain] of cases) {
      const checkpoint = domain.checkpoints.find(
        (c) => c.checkpoint_id === id,
      ) as gatemem.Checkpoint;
      const run = await setUp(domain, id, createFakeAdapter(), READ_LIMIT);
      const c2 = await run.c2(checkpoint.query_text);
      const patterns =
        checkpoint.query_type === "utility"
          ? (checkpoint.judge_spec.include ?? [])
          : (checkpoint.leak_targets ?? []);
      const holding = new Set(
        run.items
          .filter((i) => patterns.some((p) => gatemem.patternHits(String(i.content), p)))
          .map(refOf),
      );
      if (c2.length > 0) found++;
      if (holding.size > 0) located++;
      if (c2.some((r) => holding.has(r))) recalled++;
      run.close();
    }
    const n = cases.length;
    // Reported in docs/log/2026-11-02-x1r2-retrieval-floor.md.
    expect({ n, found, located }).toEqual({
      n: 20,
      found: expect.any(Number),
      located: expect.any(Number),
    });
    expect(Math.abs(found - located) / n).toBeLessThanOrEqual(0.1);
    expect(found / n).toBeGreaterThanOrEqual(0.9);
    expect(recalled).toBeGreaterThan(0);
  }, 300_000);
});

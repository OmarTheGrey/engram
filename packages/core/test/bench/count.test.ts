// Card X15: the counting Db and the plane-overhead workload. Query counts are
// deterministic, so they are asserted exactly; the suite's timings are not,
// and are judged by research/scripts/perf_budget.py, never here.
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import { countingDb, type QueryCounts } from "../../bench/count.ts";
import { type CellRecord, runSuite, type SuiteConfig } from "../../bench/plane-overhead.ts";
import {
  backgroundItem,
  backgroundScope,
  call,
  holdsNeedle,
  OPS,
  type Op,
  openBaseline,
  planeOver,
  populate,
  scopeCount,
} from "../../bench/workload.ts";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { accessTime } from "../../src/plane/read.ts";
import { loadPreset, PRESETS, type PresetName } from "../../src/policy/load.ts";

const AT = "2026-11-21T12:00:00Z";

describe("countingDb", () => {
  test("counts every prepare, statement execution, row returned, exec and transaction, and nothing else", () => {
    const counting = countingDb(openSqlite(":memory:"));
    const { db } = counting;
    db.exec("CREATE TABLE t (x INTEGER)");
    const insert = db.prepare("INSERT INTO t (x) VALUES (?)");
    db.transaction(() => {
      insert.run(1);
      insert.run(2);
      db.transaction(() => insert.run(3));
    });
    expect(db.prepare("SELECT count(*) AS n FROM t").get()).toEqual({ n: 3 });
    expect(db.prepare("SELECT x FROM t WHERE x > 9").get()).toBeUndefined();
    db.prepare("SELECT x FROM t").all();
    expect(counting.counts()).toEqual({
      prepares: 4,
      statements: 6,
      rows: 4,
      execs: 1,
      transactions: 2,
    });
    counting.reset();
    expect(counting.counts()).toEqual({
      prepares: 0,
      statements: 0,
      rows: 0,
      execs: 0,
      transactions: 0,
    });
    db.close();
  });
});

describe("the workload", () => {
  test("exactly `hits` background items hold the needle, at every suite size", () => {
    for (const size of [100, 1000, 10_000, 100_000]) {
      let found = 0;
      for (let n = 0; n < size; n++) if (holdsNeedle(n, size, 10)) found++;
      expect(found, `size ${size}`).toBe(10);
    }
  });

  test("the baseline's read returns the same rows as the background holds", () => {
    const baseline = openBaseline(":memory:", 100, 10);
    expect(() => baseline.call("sqlite-read")(0)).not.toThrow();
    baseline.close();
  });

  test("background items are what populate writes", () => {
    expect(backgroundItem(0, 100, 10).content).toContain("needle");
    expect(backgroundItem(1, 100, 10).content).not.toContain("needle");
  });
});

/** A fresh log and fake store of `size` background items, and a counting Db over the log. */
async function fresh(size: number) {
  const raw = openSqlite(":memory:");
  migrate(raw);
  const adapter = createFakeAdapter();
  let ids = 0;
  const next = () => ++ids;
  await populate(planeOver(raw, adapter, loadPreset("medium"), next), size, 10, AT);
  const counting = countingDb(raw);
  // The counting handle's first look at the log's head reads every event
  // (plane/read.ts, logHead); take it here, as the suite does, so the
  // counts are a steady call's.
  accessTime(counting.db, AT);
  return {
    size,
    raw,
    counting,
    plane: (preset: PresetName) => planeOver(counting.db, adapter, loadPreset(preset), next),
  };
}

/** One call of `op` under `preset`, numbered `n`, and what it asked of the Db. */
async function countOne(
  store: Awaited<ReturnType<typeof fresh>>,
  preset: PresetName,
  op: Op,
  n = 0,
) {
  store.counting.reset();
  await call(store.plane(preset), op, preset, store.size, 10, AT)(n);
  return store.counting.counts();
}

/** The counts of each op under each preset, every call on its own fresh store, as the suite runs them. */
async function freshCounts(size: number) {
  const out: Record<string, QueryCounts> = {};
  for (const preset of PRESETS)
    for (const op of OPS) {
      const store = await fresh(size);
      out[`${preset} ${op}`] = await countOne(store, preset, op);
      store.raw.close();
    }
  return out;
}

/** The counts of every op under every preset, one after another on one store. */
async function sequentialCounts(size: number) {
  const store = await fresh(size);
  const out: Record<string, QueryCounts> = {};
  for (const preset of PRESETS)
    for (const op of OPS) out[`${preset} ${op}`] = await countOne(store, preset, op);
  store.raw.close();
  return out;
}

const withoutRows = (counts: Record<string, QueryCounts>) =>
  Object.fromEntries(Object.entries(counts).map(([k, { rows: _, ...rest }]) => [k, rest]));

describe("queries per call (card X15)", () => {
  test("are exactly these on a fresh store of 100 items, under every preset", async () => {
    expect(await freshCounts(100)).toEqual(EXPECTED_100);
  });

  test("statements do not grow with the store: 2,000 items over two scopes ask what 100 ask, while the rows read grow", async () => {
    expect(scopeCount(2000)).toBe(2);
    const small = await sequentialCounts(100);
    const large = await sequentialCounts(2000);
    expect(withoutRows(large)).toEqual(withoutRows(EXPECTED_100));
    expect(withoutRows(small)).toEqual(withoutRows(EXPECTED_100));
    // Finding X15-2: every call reads whole tables, so 1,900 more items
    // are 1,900 more rows per full scan of the projection: three scans in
    // an allowed write, one in a denied write, two in a read.
    for (const preset of PRESETS) {
      const grew = (op: Op) =>
        (large[`${preset} ${op}`]?.rows ?? 0) - (small[`${preset} ${op}`]?.rows ?? 0);
      expect(grew("write"), preset).toBe(3 * 1900);
      expect(grew("write-deny"), preset).toBe(1900);
      expect(grew("read"), preset).toBe(2 * 1900);
    }
  }, 300_000);

  test("finding X15-2, a characterisation of today's plane: an allowed write reads every earlier read event, so after 50 reads it reads 50 more rows in the same statements", async () => {
    const before = await fresh(100);
    const cold = await countOne(before, "medium", "write");
    before.raw.close();
    const after = await fresh(100);
    for (let n = 1; n <= 50; n++) await countOne(after, "medium", "read", n);
    const warm = await countOne(after, "medium", "write");
    // A fix of retentionUsage's scan of every read event makes this equal.
    expect({ ...warm, rows: warm.rows - 50 }).toEqual(cold);
    after.raw.close();
  });

  test("a denied write's work does not grow with the read history", async () => {
    const before = await fresh(100);
    const cold = await countOne(before, "medium", "write-deny");
    before.raw.close();
    const after = await fresh(100);
    for (let n = 1; n <= 50; n++) await countOne(after, "medium", "read", n);
    expect(await countOne(after, "medium", "write-deny")).toEqual(cold);
    after.raw.close();
  });
});

describe("the suite", () => {
  const suite: SuiteConfig = {
    stores: ["fake"],
    sizes: [20],
    presets: ["medium", "medium"],
    hits: 2,
    at: AT,
    iterations: { 20: 3 },
    warmup: 1,
  };

  test("writes a header, a population, and one cell per (store, size, preset, op), each on its own copy of the store (finding X15-1)", async () => {
    const records = [];
    for await (const r of runSuite(suite)) records.push(r);
    expect(records[0]).toMatchObject({ record: "header", suite, tinybench: "6.2.3" });
    const names = records
      .slice(1)
      .map((r) => (r.record === "cell" ? `${r.preset ?? "-"} ${r.op}` : r.record));
    expect(names).toEqual([
      "- sqlite-write",
      "- sqlite-read",
      "populate",
      ...["medium", "medium"].flatMap((p) => OPS.map((op) => `${p} ${op}`)),
    ]);
    const cells = records.filter((r): r is CellRecord => r.record === "cell");
    for (const c of cells) expect(c.samples_ms).toHaveLength(3);
    // Both medium runs of an op start from the same log and ask the same;
    // and since every cell has its own copy, every op starts from the template.
    const fake = cells.filter((c) => c.store === "fake");
    for (const op of OPS) {
      const [first, second] = fake.filter((c) => c.op === op);
      expect(second?.start, op).toEqual(first?.start);
      expect(second?.queries, op).toEqual(first?.queries);
    }
    const starts = new Set(fake.map((c) => JSON.stringify(c.start)));
    expect(starts.size).toBe(1);
    expect(fake[0]?.start.items).toBe(20);
    expect(backgroundScope(0)).toBe("team:bg-0000");
  });
});

// One call's queries on a fresh store of 100 items, on a warm handle. A
// write: 17 statements in 3 transactions (the decision, the commit, the
// budget check; one more since card E1.7, the lookup that refuses a write
// under an id an offboarding swept), reading 305 rows (the projection three times, 101 items
// each, and two more); a denied write: 6 statements in 1, 102 rows (the
// projection once); a read: 16 in 2, 202 rows (the projection twice). The
// same under every preset. (Card X15's first version counted one statement
// fewer on a strict read: strict ran first, on a handle that had not yet
// looked at the log's head; review finding X15-1.)
const q = (prepares: number, statements: number, rows: number, transactions: number) => ({
  prepares,
  statements,
  rows,
  execs: 0,
  transactions,
});
const write = q(18, 17, 305, 3);
const deny = q(7, 6, 102, 1);
const read = q(7, 16, 202, 2);
const EXPECTED_100 = Object.fromEntries(
  PRESETS.flatMap((p) => [
    [`${p} write`, write],
    [`${p} write-deny`, deny],
    [`${p} read`, read],
  ]),
);

// Card X15: the counting Db and the plane-overhead workload. Query counts are
// deterministic, so they are asserted exactly; the suite's timings are not,
// and are judged by research/scripts/perf_budget.py, never here.
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import { countingDb } from "../../bench/count.ts";
import { runSuite, type SuiteConfig } from "../../bench/plane-overhead.ts";
import {
  backgroundItem,
  call,
  holdsNeedle,
  openBaseline,
  planeOver,
  populate,
} from "../../bench/workload.ts";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { loadPreset, PRESETS } from "../../src/policy/load.ts";

const AT = "2026-11-21T12:00:00Z";

describe("countingDb", () => {
  test("counts every prepare, statement execution, exec and transaction, and nothing else", () => {
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
    db.prepare("SELECT x FROM t").all();
    expect(counting.counts()).toEqual({ prepares: 3, statements: 5, execs: 1, transactions: 2 });
    counting.reset();
    expect(counting.counts()).toEqual({ prepares: 0, statements: 0, execs: 0, transactions: 0 });
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
});

/** The query counts of one call of each op on a fresh store of `size` items on the fake. */
async function countsAt(size: number) {
  const raw = openSqlite(":memory:");
  migrate(raw);
  const adapter = createFakeAdapter();
  let ids = 0;
  const next = () => ++ids;
  await populate(planeOver(raw, adapter, loadPreset("medium"), next), size, 10, AT);
  const counting = countingDb(raw);
  const out: Record<string, unknown> = {};
  for (const preset of PRESETS) {
    const plane = planeOver(counting.db, adapter, loadPreset(preset), next);
    for (const op of ["write", "write-deny", "read"] as const) {
      counting.reset();
      await call(plane, op, preset, size, 10, AT)(0);
      out[`${preset} ${op}`] = counting.counts();
    }
  }
  raw.close();
  return out;
}

describe("queries per call (card X15)", () => {
  test("are exactly these on a store of 100 items, under every preset", async () => {
    expect(await countsAt(100)).toEqual(EXPECTED_100);
  });

  test("do not grow with the store: 400 items ask the same as 100", async () => {
    expect(await countsAt(400)).toEqual(EXPECTED_100);
  });

  test("background items are what populate writes", () => {
    expect(backgroundItem(0, 100, 10).content).toContain("needle");
    expect(backgroundItem(1, 100, 10).content).not.toContain("needle");
  });
});

describe("the suite", () => {
  test("writes a header and one cell per (store, size, preset, op), each with its samples", async () => {
    const suite: SuiteConfig = {
      stores: ["fake"],
      sizes: [20],
      presets: ["medium"],
      hits: 2,
      at: AT,
      iterations: { 20: 3 },
      warmup: 1,
    };
    const records = [];
    for await (const r of runSuite(suite)) records.push(r);
    expect(records[0]).toMatchObject({ record: "header", suite, tinybench: "6.2.3" });
    const cells = records
      .slice(1)
      .map((r) => (r.record === "cell" ? `${r.store} ${r.op}` : r.record));
    expect(cells).toEqual([
      "sqlite sqlite-write",
      "sqlite sqlite-read",
      "populate",
      "fake write",
      "fake write-deny",
      "fake read",
    ]);
    for (const r of records.slice(1)) if (r.record === "cell") expect(r.samples_ms).toHaveLength(3);
  });
});

// One call's queries. A write: 16 statements in 3 transactions (the decision,
// the commit, the budget check); a denied write: 6 in 1; a read: 16 in 2,
// one fewer under strict. Per preset the same, apart from that read.
const q = (prepares: number, statements: number, transactions: number) => ({
  prepares,
  statements,
  execs: 0,
  transactions,
});
const EXPECTED_100 = {
  "strict write": q(17, 16, 3),
  "strict write-deny": q(7, 6, 1),
  "strict read": q(6, 15, 2),
  "medium write": q(17, 16, 3),
  "medium write-deny": q(7, 6, 1),
  "medium read": q(7, 16, 2),
  "permissive write": q(17, 16, 3),
  "permissive write-deny": q(7, 6, 1),
  "permissive read": q(7, 16, 2),
};

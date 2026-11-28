// The erasure-residue check (card X19, proposal U7) on its first two persons,
// on SQLite: person 1 holds the record a read-only store keeps, person 2 the
// record that moved. The full run (20 persons, both backends, four stores) is
// research/scripts/h3_erasure_residue.py's, through `make test-repro`.
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { drawCanaries } from "../../src/residue/canaries.ts";
import {
  type CanaryRow,
  type CheckOutcome,
  runResidueCheck,
  type StoreName,
} from "../../src/residue/check.ts";

const CASSETTES = fileURLToPath(
  new URL("../../../../fixtures/cassettes/x19-erasure-residue", import.meta.url),
);
const SEED = 20261128;

const runs = new Map<StoreName, Promise<CheckOutcome>>();
const run = (store: StoreName) => {
  if (!runs.has(store))
    runs.set(
      store,
      runResidueCheck({ backend: "sqlite", store, seed: SEED, cassettes: CASSETTES, persons: 2 }),
    );
  return runs.get(store) as Promise<CheckOutcome>;
};

const exposed = (o: CheckOutcome) => o.canaries.filter((c) => c.role !== "never");
const residueIn = (c: CanaryRow, tier: keyof CanaryRow["text"]) =>
  c.text[tier] === "residue" || c.hash[tier] === "residue";

describe("the canaries", () => {
  test("are drawn from the seed alone, distinct, and none holds another", () => {
    const a = drawCanaries(SEED, 400);
    expect(drawCanaries(SEED, 400)).toEqual(a);
    expect(new Set(a).size).toBe(400);
    expect(drawCanaries(SEED + 1, 400)).not.toEqual(a);
    for (const c of a) {
      expect(c).toMatch(/^canary-[a-z]+-[a-z]+-\d{4}$/);
      expect(a.filter((d) => d !== c && d.includes(c))).toEqual([]);
    }
  });
});

describe.each(["mcp-memory", "files"] as const)("the check on SQLite and %s", (store) => {
  test("finds every exposed canary in the projection, the events and the store before the offboarding", async () => {
    const o = await run(store);
    expect(exposed(o)).toHaveLength(20);
    for (const c of exposed(o)) expect(c.before).toEqual(["projection", "events", "store-records"]);
    expect(o.summary_calls).toEqual({ hits: 2, recorded: 0 });
  }, 120_000);

  test("after it, the log tiers hold no erased canary, and the store keeps exactly the two records card E1.7 names", async () => {
    const o = await run(store);
    expect(o.reports).toMatchObject({ left_in_store: 1, not_found_in_store: 1, store_failures: 0 });
    for (const c of exposed(o))
      for (const tier of ["projection", "explanations", "events", "log-other"] as const)
        expect(residueIn(c, tier), `${c.person}/${c.slot} in ${tier}`).toBe(false);
    const stored = exposed(o).filter((c) => residueIn(c, "store-records"));
    expect(stored.map((c) => [c.person, c.slot, c.role])).toEqual([
      [1, 5, "left-in-store"],
      [2, 5, "not-found"],
    ]);
    // Their content hashes stay in the erase events by decision.
    for (const c of stored) expect(c.hash.events).toBe("erased-content-hash");
  }, 120_000);

  test("counts the promoted and the shared-ref facts as retained by decision, never as residue, and finds no never-exposed canary", async () => {
    const o = await run(store);
    for (const c of exposed(o).filter((c) => c.slot === 3)) {
      expect(c.text.projection).toBe("promoted");
      expect(c.text["store-records"]).toBe("promoted");
    }
    for (const c of exposed(o).filter((c) => c.slot === 4)) {
      expect(c.text["store-records"]).toBe("shared-store-ref");
      expect(c.text.projection).toBe("shared-store-ref");
      expect(Object.values(c.text)).not.toContain("residue");
    }
    // In the bytes a kept canary is indeterminate, never retained and never residue.
    for (const c of exposed(o).filter((c) => c.slot === 3 || c.slot === 4))
      for (const tier of ["db-file", "db-wal", "store-files"] as const) {
        expect([undefined, "indeterminate"]).toContain(c.text[tier]);
        expect([undefined, "indeterminate"]).toContain(c.hash[tier]);
      }
    for (const c of o.canaries.filter((c) => c.role === "never")) {
      expect(c.text).toEqual({});
      expect(c.hash).toEqual({});
    }
    expect(o.byte_tiers).toEqual({
      "db-file": true,
      "db-wal": true,
      "store-files": true,
      "store-history": false,
    });
  }, 120_000);
});

describe("the check's bytes", () => {
  test("are the same on a second run", async () => {
    const again = await runResidueCheck({
      backend: "sqlite",
      store: "mcp-memory",
      seed: SEED,
      cassettes: CASSETTES,
      persons: 2,
    });
    expect(JSON.stringify(again)).toBe(JSON.stringify(await run("mcp-memory")));
  }, 120_000);
});

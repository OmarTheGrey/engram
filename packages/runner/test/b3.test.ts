// Card B3: GateMem through the plane. The pipeline config runs one access
// control, one forgetting and one utility checkpoint under C5 on every store
// from the committed cassettes, and each probe's output holds the plane's
// write and read events. A cross-principal read the mapping forbids is
// denied with the same events on every store.
import { gatemem } from "@engram/bench";
import { createPlane, loadPreset, type MemoryEvent, migrate, openSqlite } from "@engram/core";
import { describe, expect, test } from "vitest";
import { readRunnerConfig, STORES } from "../src/config.ts";
import { sequentialIds } from "../src/gatemem-probe.ts";
import { memoryCache } from "../src/model/cached.ts";
import { runConfig } from "../src/run.ts";
import { openStore } from "../src/stores.ts";
import { B3 } from "./paths.ts";

const config = readRunnerConfig(B3);

describe("acceptance (card B3): GateMem probes through the plane on every store", () => {
  test("offline, the committed cassettes answer every call; each probe logs its writes and its read", async () => {
    const first = await runConfig(config, { offline: true });
    const again = await runConfig(config, { offline: true });
    expect(first.calls).toEqual({ new: 0, cached: 12 });
    expect(again.calls).toEqual({ new: 0, cached: 12 });
    expect(again.rows).toEqual(first.rows);
    expect(first.rows.map((r) => [r.checkpoint_id.slice(-7), r.store])).toEqual([
      ["ckpt_08", "fake"],
      ["ckpt_08", "mem0"],
      ["ckpt_11", "fake"],
      ["ckpt_11", "mem0"],
      ["ckpt_20", "fake"],
      ["ckpt_20", "mem0"],
    ]);
    for (const r of first.rows) {
      const writes = r.events.filter((e) => e.op === "write");
      expect(writes).toHaveLength(r.ingested.turns);
      expect(writes.every((e) => e.decision === "allow")).toBe(true);
      expect(r.ingested.stored).toBe(r.ingested.turns);
      expect(r.events.at(-1)).toMatchObject({ op: "read", decision: "allow" });
      expect(r.decisions.at(-1)).toMatchObject({ op: "read" });
    }
    expect(Object.keys(first.summary)).toEqual(["C5@fake", "C5@mem0"]);
  }, 120_000);

  test("a different store is a different cache key", async () => {
    const cache = memoryCache();
    const fakeOnly = { ...config, items: [config.items[1] as string], store: "fake" as const };
    await runConfig(fakeOnly, { cache, offline: false });
    const mem0 = await runConfig({ ...fakeOnly, store: "mem0" }, { cache, offline: false });
    expect(mem0.calls.new).toBeGreaterThan(0);
  }, 60_000);
});

/** An event without its item (whose store_ref names the store). */
const storeNeutral = (e: MemoryEvent) => {
  const { item: _item, ...rest } = e;
  return rest;
};

describe("a cross-principal read the mapping forbids is denied the same way on every store", () => {
  const domains = gatemem.loadDataset(config.data);
  const office = domains.find((d) => d.domain === "office") as gatemem.Domain;
  // A Moonstone contractor at the as-of turn of the access-control checkpoint.
  const checkpoint = office.checkpoints.find((c) =>
    c.checkpoint_id.endsWith("_ckpt_11"),
  ) as gatemem.Checkpoint;
  const episode = office.episodes[0] as gatemem.Episode;
  const logs: Record<string, MemoryEvent[]> = {};

  for (const store of STORES) {
    test(`on ${store}: the Monsoon members' turns stay out of reach; the Moonstone members' come through their grants`, async () => {
      const newId = sequentialIds();
      const mapped = gatemem.mapCheckpoint(episode, checkpoint, newId);
      const db = openSqlite(":memory:");
      migrate(db);
      const plane = createPlane({
        db,
        adapter: await openStore(store),
        policy: loadPreset("medium"),
        newId,
      });
      for (const { actor, item } of mapped.writes) await plane.write(actor, item, item.valid_from);
      const lena = mapped.asker;
      expect(lena.id).toBe("person:contractor_lena_park");

      const read = await plane.read(lena, { at: mapped.at });
      const scopes = new Set(read.items.map((i) => i.scope));
      // The SRE on Monsoon wrote turns before the as-of turn; none reaches Lena.
      const sre = mapped.writes.filter((w) => w.item.scope === "person:sre_jordan_kim");
      expect(sre.length).toBeGreaterThan(0);
      expect(scopes.has("person:sre_jordan_kim")).toBe(false);
      for (const scope of scopes) {
        expect([
          "person:contractor_lena_park",
          "person:manager_alex_romero",
          "person:employee_nina_torres",
          "person:employee_samir_shah",
        ]).toContain(scope);
      }
      expect(read.event.decision).toBe("allow");
      expect(read.event.reason).toMatch(/\d+ projected items outside the reader's reach/);
      // What Lena reads of others comes through a grant the mapping wrote.
      const granted = read.explanations.filter((x) => x.policy_id === "preset.medium/read/grants");
      expect(granted.length).toBeGreaterThan(0);
      for (const x of granted) {
        expect(x.grants_used.some((g) => g.endsWith(":person:contractor_lena_park"))).toBe(true);
      }
      logs[store] = plane.events();
      db.close();
    }, 60_000);
  }

  test("the events, decisions and reasons are identical on every store apart from the store_ref", () => {
    const [first, ...rest] = STORES.map((s) => logs[s]?.map(storeNeutral));
    expect(first?.length).toBeGreaterThan(1);
    for (const events of rest) expect(events).toEqual(first);
  });
});

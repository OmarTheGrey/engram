// C4's evidence on GateMem (docs/tasks/prereg-v1-plan.md, PR 4, part A,
// deliverables 2 and 3): the two verdict sources' agreement and the walk's
// list lengths, per checkpoint of the GateMem fixture, held to what the
// runner's C3 and C4 reads and C4's metadata actually show.
import { join } from "node:path";
import { createFakeAdapter } from "@engram/adapters";
import { gatemem } from "@engram/bench";
import { loadPreset } from "@engram/core";
import { describe, expect, test } from "vitest";
import { c4Read, READ_LIMIT, type UngovernedStore, ungovernedRead } from "../../src/conditions.ts";
import { gatememMetadata, sequentialIds } from "../../src/gatemem-probe.ts";
import { verdictRow, walkRow } from "../../src/research/c4-evidence.ts";

const DATA = join(import.meta.dirname, "../../../../fixtures/bench/gatemem");
const domains = gatemem.loadDataset(DATA);
const checkpoints = domains.flatMap((d) => d.checkpoints.map((c) => ({ d, c })));
const policy = loadPreset("medium");

const mappingOf = (d: gatemem.Domain, c: gatemem.Checkpoint) =>
  gatemem.mapCheckpoint(
    d.episodes.find((e) => e.episode_id === c.episode_id) as gatemem.Episode,
    c,
    sequentialIds(),
  );

describe("the verdict agreement counts", () => {
  test("every turn item up to the as-of turn is counted once, in exactly one cell", () => {
    expect(checkpoints.length).toBe(20);
    for (const { d, c } of checkpoints) {
      const row = verdictRow(d, c, policy);
      const mapped = mappingOf(d, c);
      expect(row.all.items).toBe(mapped.writes.length);
      for (const a of [row.all, row.leak]) {
        expect(a.agree + a.rag_allows_engram_denies + a.rag_denies_engram_allows).toBe(a.items);
      }
      expect(row.leak.items).toBeLessThanOrEqual(row.all.items);
    }
  });

  test("the verdicts counted are the ones C4 shows under each source", () => {
    let disagreements = 0;
    for (const { d, c } of checkpoints) {
      const mapped = mappingOf(d, c);
      const engram = gatememMetadata(mapped, "engram", policy);
      const rag = gatememMetadata(mapped, "gatemem-rag");
      let agree = 0;
      for (const { item } of mapped.writes) {
        if (engram.admits?.(item) === rag.admits?.(item)) agree++;
      }
      const row = verdictRow(d, c, policy);
      expect(row.all.agree).toBe(agree);
      disagreements += row.all.items - row.all.agree;
    }
    // The fixture exercises both sources apart, or the test above says nothing.
    expect(disagreements).toBeGreaterThan(0);
  });

  test("the decisions do not read the hidden labels: relabelling everything but the targets moves nothing", () => {
    for (const { d, c } of checkpoints) {
      const relabelled = {
        ...c,
        query_type: c.query_type === "privacy" ? "utility" : "privacy",
        expected_action: "refuse",
        attack_type: "planted",
        judge_spec: { include: ["planted"], not_include: ["planted"] },
      } as gatemem.Checkpoint;
      const domain = { ...d, checkpoints: [relabelled] };
      const { all, leak } = verdictRow(domain, relabelled, policy);
      const row = verdictRow(d, c, policy);
      expect({ all, leak }).toEqual({ all: row.all, leak: row.leak });
    }
  });

  test("a turn holds a leak target only by the checkpoint's own leak_targets", () => {
    for (const { d, c } of checkpoints) {
      const none = { ...c, leak_targets: [] } as gatemem.Checkpoint;
      expect(verdictRow(d, none, policy).leak.items).toBe(0);
    }
    const located = checkpoints.filter(({ d, c }) => verdictRow(d, c, policy).leak.items > 0);
    expect(located.length).toBeGreaterThan(0);
  });
});

async function storeOf(d: gatemem.Domain, c: gatemem.Checkpoint): Promise<UngovernedStore> {
  const store: UngovernedStore = { adapter: createFakeAdapter(), scopes: new Set() };
  for (const { item } of mappingOf(d, c).writes) {
    await store.adapter.write(item);
    store.scopes.add(item.scope);
  }
  return store;
}

describe("the walk counts", () => {
  test("C3's and C4's lengths are those of the runner's own reads for the checkpoint's question", async () => {
    for (const { d, c } of checkpoints) {
      const mapped = mappingOf(d, c);
      const store = await storeOf(d, c);
      const row = walkRow(d, c, policy);
      const query = mapped.checkpoint.query_text;
      expect(row.c3).toBe((await ungovernedRead(store, query, mapped.at)).length);
      const admits = gatememMetadata(mapped, "engram", policy).admits as NonNullable<
        ReturnType<typeof gatememMetadata>["admits"]
      >;
      expect(row.c4).toBe((await c4Read(store, query, mapped.at, READ_LIMIT, admits)).length);
      expect(row.c4_allowed_equals_c5).toBe(true);
      expect(row.c4_allowed).toBe(row.c5);
      expect(row.c3).toBe(Math.min(READ_LIMIT, row.candidates));
    }
  });

  test("on the fixture the lengths are PR 3's published ones", () => {
    const lengths = checkpoints.map(({ d, c }) => walkRow(d, c, policy).c4).sort((a, b) => a - b);
    const q = (p: number) => lengths[Math.floor(p * (lengths.length - 1))];
    expect([lengths[0], q(0.25), q(0.5), q(0.75), lengths.at(-1)]).toEqual([1, 25, 42, 73, 180]);
    expect(lengths.filter((n) => n > READ_LIMIT).length).toBe(17);
  });

  test("a denied leak item one list shows and the other does not is counted on the right side", () => {
    let c3Only = 0;
    let c4Only = 0;
    for (const { d, c } of checkpoints) {
      const row = walkRow(d, c, policy);
      expect(row.c3_only_denied_leak).toBeLessThanOrEqual(row.c3_denied_leak);
      expect(row.c4_only_denied_leak).toBeLessThanOrEqual(row.c4_denied_leak);
      // C4 is a prefix of the ranking and C3 its first READ_LIMIT items, so
      // only the longer list can hold what the shorter does not.
      if (row.c4 <= row.c3) expect(row.c4_only_denied_leak).toBe(0);
      if (row.c3 <= row.c4) expect(row.c3_only_denied_leak).toBe(0);
      c3Only += row.c3_only_denied_leak;
      c4Only += row.c4_only_denied_leak;
    }
    expect(c3Only + c4Only).toBeGreaterThan(0);
  });

  test("with no item the plane admits, C4 shows nothing while C3 shows the candidates", () => {
    const { d, c } = checkpoints[0] as (typeof checkpoints)[number];
    const closed = { ...policy, read: { matrix: [], honour_grants: false } };
    const row = walkRow(d, c, closed);
    expect(row.candidates).toBeGreaterThan(0);
    expect(row).toMatchObject({ c4: 0, c5: 0, c3: Math.min(READ_LIMIT, row.candidates) });
  });
});

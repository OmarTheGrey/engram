// Card B3: GateMem through the plane. The pipeline config runs one access
// control, one forgetting and one utility checkpoint under C5 on every store
// from the committed cassettes, and each probe's output holds the plane's
// write and read events. A cross-principal read the mapping forbids is
// denied with the same events on every store.
import { gatemem } from "@engram/bench";
import {
  createPlane,
  loadPreset,
  type MemoryEvent,
  migrate,
  openSqlite,
  type Policy,
} from "@engram/core";
import { describe, expect, test } from "vitest";
import { readRunnerConfig, STORES } from "../src/config.ts";
import {
  IngestionDivergedError,
  probeInputs,
  readProbeScript,
  runProbe,
  sequentialIds,
} from "../src/gatemem-probe.ts";
import { memoryCache } from "../src/model/cached.ts";
import { scriptedAnswers } from "../src/model/cassette.ts";
import { runConfig } from "../src/run.ts";
import { openStore } from "../src/stores.ts";
import { B3 } from "./paths.ts";

const config = readRunnerConfig(B3);

describe("acceptance (card B3): GateMem probes through the plane on every store", () => {
  test("offline, the committed cassettes answer every call; each probe logs its writes and its read", async () => {
    const first = await runConfig(config, { offline: true });
    const again = await runConfig(config, { offline: true });
    expect(first.calls).toEqual({ new: 0, cached: 18 });
    expect(again.calls).toEqual({ new: 0, cached: 18 });
    expect(again.rows).toEqual(first.rows);
    expect(first.rows.map((r) => [r.checkpoint_id.slice(-7), r.store])).toEqual([
      ["ckpt_08", "fake"],
      ["ckpt_08", "mem0"],
      ["ckpt_08", "letta"],
      ["ckpt_11", "fake"],
      ["ckpt_11", "mem0"],
      ["ckpt_11", "letta"],
      ["ckpt_20", "fake"],
      ["ckpt_20", "mem0"],
      ["ckpt_20", "letta"],
    ]);
    for (const r of first.rows) {
      const writes = r.events.filter((e) => e.op === "write");
      expect(writes).toHaveLength(r.ingested.turns);
      expect(writes.every((e) => e.decision === "allow")).toBe(true);
      expect(r.ingested.stored).toBe(r.ingested.turns);
      expect(r.events.at(-1)).toMatchObject({ op: "read", decision: "allow" });
      expect(r.decisions.at(-1)).toMatchObject({ op: "read" });
    }
    expect(Object.keys(first.summary)).toEqual(["C5@fake", "C5@mem0", "C5@letta"]);
    // The Letta sessions commit every ingested turn (474 per run, twice): about
    // three git processes each, tens of milliseconds apiece on Windows, a few on
    // Linux. The bound covers the slow machine; CI takes far less.
  }, 600_000);

  test("a different store is a different cache key", async () => {
    const cache = memoryCache();
    const fakeOnly = { ...config, items: [config.items[1] as string], store: "fake" as const };
    await runConfig(fakeOnly, { cache, offline: false });
    const mem0 = await runConfig({ ...fakeOnly, store: "mem0" }, { cache, offline: false });
    expect(mem0.calls.new).toBeGreaterThan(0);
  }, 60_000);
});

/** An event with the store's own part, the store_ref of the item it carries, masked (R5-6). */
const storeNeutral = (e: MemoryEvent) =>
  e.item ? { ...e, item: { ...e.item, store_ref: { adapter: "<store>", key: "<key>" } } } : e;

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
    }, 180_000);
  }

  test("the events, decisions and reasons are identical on every store apart from the store_ref", () => {
    const [first, ...rest] = STORES.map((s) => logs[s]?.map(storeNeutral));
    expect(first?.length).toBeGreaterThan(1);
    for (const events of rest) expect(events).toEqual(first);
  });
});

const officeDomain = () =>
  gatemem.loadDataset(config.data).find((d) => d.domain === "office") as gatemem.Domain;
const scriptFor = (id: string) => readProbeScript(config.script as string).steps[id] ?? [];
const scripted = (id: string) => () =>
  scriptedAnswers(scriptFor(id), { provider: "scripted", model: "scripted-1" });

describe("C5 ingestion cannot diverge from C2 and C3 (R5-7)", () => {
  const office = officeDomain();
  const id = config.items[1] as string;
  // The strict preset, made stricter: no episodic item in person scope, so
  // every turn write is denied. C2 and C3 would still hold every turn.
  const strict = loadPreset("strict");
  const noEpisodic: Policy = {
    ...strict,
    write: strict.write.map((r) =>
      r.scope === "person" ? { ...r, forbidden_classes: ["episodic"] } : r,
    ),
  };

  test("a C5 ingestion write the policy denies fails the probe, naming the turn and the rule", async () => {
    const run = runProbe({
      domain: office,
      checkpointId: id,
      condition: "C5",
      seed: 1,
      model: "scripted/scripted-1",
      preset: "strict",
      policy: noEpisodic,
      store: "fake",
      cache: memoryCache(),
      answers: scripted(id),
      offline: false,
    });
    await expect(run).rejects.toThrow(IngestionDivergedError);
    await expect(run).rejects.toThrow(
      /write deny by preset\.strict\/write\/person: episodic items are forbidden in person scope/,
    );
  }, 60_000);
});

describe("the probe's prompts and writes read no hidden field (R5-10)", () => {
  const office = officeDomain();
  const id = config.items[1] as string;
  /** The office domain with every hidden field of the probe's checkpoint changed. */
  const relabelled = (): gatemem.Domain => ({
    ...office,
    checkpoints: office.checkpoints.map((c) =>
      c.checkpoint_id === id
        ? {
            ...c,
            query_type: c.query_type === "privacy" ? "utility" : "privacy",
            expected_action: c.expected_action === "refuse" ? "answer" : "refuse",
            judge_spec: { expected_action: "answer", include: ["planted"], notes: "planted" },
            leak_targets: ["planted leak target"],
            attack_type: "planted",
          }
        : c,
    ),
  });

  test("probeInputs gives the same system and user prompts, asker and writes", () => {
    const base = probeInputs(office, id, sequentialIds());
    const other = probeInputs(relabelled(), id, sequentialIds());
    expect(other.checkpoint.leak_targets).toEqual(["planted leak target"]);
    expect(other.system).toBe(base.system);
    expect(other.user).toBe(base.user);
    expect(other.mapped).toEqual(base.mapped);
    expect(`${other.system}${other.user}`).not.toContain("planted");
  });

  test("runProbe on the relabelled checkpoint replays the original's calls with no new call", async () => {
    const cache = memoryCache();
    const spec = {
      checkpointId: id,
      condition: "C5" as const,
      seed: 1,
      model: "scripted/scripted-1",
      preset: "medium" as const,
      policy: loadPreset("medium"),
      store: "fake" as const,
      cache,
      answers: scripted(id),
    };
    const base = await runProbe({ ...spec, domain: office, offline: false });
    const hits: boolean[] = [];
    const other = await runProbe({
      ...spec,
      domain: relabelled(),
      offline: true,
      onUsage: (u) => hits.push(u.hit),
    });
    expect(hits).toEqual([true, true]);
    expect(other.events).toEqual(base.events);
    expect(other.tool_calls).toEqual(base.tool_calls);
    expect(other.output).toEqual(base.output);
  }, 60_000);
});

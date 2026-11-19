// Card RV6 (design review RV-DES-10): a run split into shards by item, each
// into its own folder against the same cassettes, merged into the one run
// the H1 table reads. pi-ai's faux provider stands in for a live provider on
// the seeded API; nothing here reaches the network.
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type CacheStore, fileCache } from "@engram/model";
import { afterAll, describe, expect, test } from "vitest";
import { type Condition, configItems, readRunnerConfig } from "../src/config.ts";
import { JournalLocked, JournalMismatch, LOCK_FILE, lockedBy } from "../src/journal.ts";
import { liveConfig, liveOptions } from "../src/live.ts";
import { EVENTS_FILE, runConfig } from "../src/run.ts";
import {
  openRunJournal,
  parseShard,
  type Shard,
  ShardRefused,
  sealMerge,
  shardConfig,
  shardDir,
  shardSlice,
} from "../src/shard.ts";
import { FAUX_MODEL, fauxLive } from "./live-fakes.ts";
import { B3 } from "./paths.ts";

const REPO = resolve(import.meta.dirname, "../../..");
const b3 = readRunnerConfig(B3);
/** B3's three checkpoints under C2 and C5 on the fake store, two seeds: twelve sessions, two calls each. */
const three = {
  ...b3,
  store: "fake" as const,
  conditions: ["C2", "C5"] as Condition[],
  seeds: [1, 2],
};

const temp: string[] = [];
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), "engram-rv6-"));
  temp.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of temp) rmSync(dir, { recursive: true, force: true });
});

const live = (cassettes: string, extra: Partial<typeof three> = {}) =>
  liveConfig({ ...three, ...extra }, { model: FAUX_MODEL, repo: REPO, cassettes, env: {} });

const read = (dir: string, file: string) => readFileSync(join(dir, file), "utf8");
const MERGED_FILES = ["results.jsonl", EVENTS_FILE, "usage.jsonl", "summary.json", "usage.json"];

/** A cache that counts the calls it answers from a cassette and the ones it records. */
function counting(dir: string) {
  const inner = fileCache(dir);
  const counts = { hits: 0, sets: 0 };
  const cache: CacheStore = {
    get: (k) => {
      const e = inner.get(k);
      if (e) counts.hits++;
      return e;
    },
    set: (e) => {
      counts.sets++;
      inner.set(e);
    },
  };
  return { cache, counts };
}

/** One shard of `config`, live on a fresh faux provider, into its folder of `out`; `crashAfter` rows then a crash. */
async function runShard(
  config: ReturnType<typeof live>,
  out: string,
  shard: Shard,
  options: { resume?: boolean; crashAfter?: number; offline?: boolean } = {},
) {
  const provider = fauxLive({ stableIds: true });
  const journal = openRunJournal(shardDir(out, shard), shardConfig(config, shard), {
    resume: options.resume ?? false,
    shard,
    sidecar: EVENTS_FILE,
  });
  let rows = 0;
  try {
    return await runConfig(shardConfig(config, shard), {
      ...(options.offline
        ? { cache: fileCache(config.cassettes), offline: true }
        : liveOptions(config, provider.models, {})),
      journal,
      shard,
      onRow: () => {
        if (options.crashAfter !== undefined && ++rows === options.crashAfter) {
          throw new Error("the machine went away");
        }
      },
    });
  } finally {
    journal.close();
  }
}

/** MERGE=n: the shards of `out` joined into it, the summary rewritten by a pass that runs nothing. */
async function merge(config: ReturnType<typeof live>, out: string, count: number) {
  const { cache, counts } = counting(config.cassettes);
  const journal = openRunJournal(out, config, { resume: true, merge: count, sidecar: EVENTS_FILE });
  try {
    const result = await runConfig(config, { cache, offline: true, journal });
    sealMerge(journal);
    return { result, counts };
  } finally {
    journal.close();
  }
}

describe("a sharded run, merged, is the unsharded run (RV-DES-10)", () => {
  test("one shard against three shards merged: byte-identical files and cassettes, and a crashed shard resumes", async () => {
    // The unsharded run: twelve sessions, live, into its own cassettes.
    const wholeCassettes = join(fresh(), "cassettes");
    const whole = fresh();
    const config = live(wholeCassettes);
    const provider = fauxLive({ stableIds: true });
    const journal = openRunJournal(whole, config, { resume: false, sidecar: EVENTS_FILE });
    const complete = await runConfig(config, {
      ...liveOptions(config, provider.models, {}),
      journal,
    });
    journal.close();
    expect(complete.sessions).toBe(12);
    expect(complete.calls).toEqual({ new: 24, cached: 0 });

    // The same run in three shards into other cassettes, shard 2 crashing
    // after its first session and resumed.
    const shardedCassettes = join(fresh(), "cassettes");
    const sharded = live(shardedCassettes);
    const out = join(fresh(), "run");
    const one = await runShard(sharded, out, { index: 1, count: 3 });
    expect(one.sessions).toBe(4);
    await expect(runShard(sharded, out, { index: 2, count: 3 }, { crashAfter: 1 })).rejects.toThrow(
      /went away/,
    );
    const two = shardDir(out, { index: 2, count: 3 });
    // The crash left the folder unlocked (the journal closed), one session kept, no summary.
    expect(existsSync(join(two, LOCK_FILE))).toBe(false);
    expect(read(two, "results.jsonl").trim().split("\n")).toHaveLength(1);
    expect(existsSync(join(two, "summary.json"))).toBe(false);
    // A merge before the shard finished is refused.
    await expect(merge(sharded, out, 3)).rejects.toThrow(/shard 2\/3 did not finish/);
    const resumed = await runShard(sharded, out, { index: 2, count: 3 }, { resume: true });
    expect(resumed.resumed).toBe(1);
    expect(resumed.sessions).toBe(4);
    expect(resumed.calls).toEqual({ new: 6, cached: 0 });
    await runShard(sharded, out, { index: 3, count: 3 });

    // The merge: every file the unsharded run wrote, byte for byte, and no call.
    const merged = await merge(sharded, out, 3);
    expect(merged.result.sessions).toBe(12);
    expect(merged.result.calls).toEqual({ new: 0, cached: 0 });
    expect(merged.counts).toEqual({ hits: 0, sets: 0 });
    for (const file of MERGED_FILES) expect(read(out, file), file).toBe(read(whole, file));
    expect(JSON.parse(read(out, "run.json"))).toEqual(JSON.parse(read(whole, "run.json")));

    // No cache key names the shard: both runs recorded the same cassettes, byte for byte.
    const names = readdirSync(wholeCassettes).sort();
    expect(readdirSync(shardedCassettes).sort()).toEqual(names);
    for (const name of names) {
      expect(readFileSync(join(shardedCassettes, name), "utf8")).toBe(
        readFileSync(join(wholeCassettes, name), "utf8"),
      );
    }
    // So the unsharded run replays the sharded run's cassettes with zero new calls.
    const replay = await runConfig(
      { ...config, cassettes: shardedCassettes },
      { cache: fileCache(shardedCassettes), offline: true },
    );
    expect(replay.calls).toEqual({ new: 0, cached: 24 });
  }, 240_000);

  test("the merge refuses a missing shard, shards of another config, and overlapping shards", async () => {
    const cassettes = join(fresh(), "cassettes");
    const config = live(cassettes, { conditions: ["C2"], seeds: [1] });
    const out = join(fresh(), "run");
    await runShard(config, out, { index: 1, count: 2 });
    await expect(merge(config, out, 2)).rejects.toThrow(/shard 2\/2 is missing/);
    // Shard 2 of a config with other seeds is not a shard of this run.
    await runShard(live(cassettes, { conditions: ["C2"], seeds: [2] }), out, {
      index: 2,
      count: 2,
    });
    await expect(merge(config, out, 2)).rejects.toThrow(
      /every shard must be a shard of one config/,
    );
    // Nor is a merge of 3 over shards of 2.
    await expect(merge(config, out, 3)).rejects.toThrow(/shard 1\/3 is missing/);
    await runShard(config, out, { index: 2, count: 2 });
    // A row of shard 1 copied into shard 2: the shards overlap.
    const first = shardDir(out, { index: 1, count: 2 });
    const second = shardDir(out, { index: 2, count: 2 });
    appendFileSync(
      join(second, "results.jsonl"),
      `${read(first, "results.jsonl").split("\n")[0]}\n`,
    );
    appendFileSync(join(second, EVENTS_FILE), `${read(first, EVENTS_FILE).split("\n")[0]}\n`);
    await expect(merge(config, out, 2)).rejects.toThrow(/is in two shards; the shards overlap/);
  }, 120_000);

  test("a resume refuses another shard's folder: the shard is in the fingerprint", async () => {
    const config = live(join(fresh(), "cassettes"), { conditions: ["C2"], seeds: [1] });
    const out = join(fresh(), "run");
    await runShard(config, out, { index: 1, count: 3 });
    expect(() =>
      openRunJournal(shardDir(out, { index: 1, count: 3 }), config, {
        resume: true,
        shard: { index: 2, count: 3 },
      }),
    ).toThrow(JournalMismatch);
    const run = JSON.parse(read(shardDir(out, { index: 1, count: 3 }), "run.json"));
    expect(run.shard).toEqual({ index: 1, count: 3 });
    expect(run.unsharded).toMatch(/^[0-9a-f]{64}$/);
    expect(run.fingerprint).not.toBe(run.unsharded);
  }, 60_000);
});

describe("the slice, the ceiling and the shard's name", () => {
  test("n contiguous blocks of the items, disjoint, covering them in order", () => {
    const items = Array.from({ length: 10 }, (_, i) => `i${i}`);
    for (const count of [1, 3, 4, 7, 10]) {
      const slices = Array.from({ length: count }, (_, k) =>
        shardSlice(items, { index: k + 1, count }),
      );
      expect(slices.flat()).toEqual(items);
      const sizes = slices.map((s) => s.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
    expect(shardSlice(items, undefined)).toEqual(items);
    expect(() => shardSlice(items, { index: 1, count: 11 })).toThrow(ShardRefused);
    // configItems slices the config's items, a list or `all`.
    expect(configItems({ name: "x", items: "all" }, items, { index: 2, count: 2 })).toEqual(
      items.slice(5),
    );
  });

  test("SHARD=i/n parses i and n with 1 <= i <= n", () => {
    expect(parseShard("2/4")).toEqual({ index: 2, count: 4 });
    for (const bad of ["0/4", "5/4", "1/0", "2", "a/b", "1.5/3"]) {
      expect(() => parseShard(bad), bad).toThrow(ShardRefused);
    }
  });

  test("a config's spend ceiling is the run's: each of n shards stops at a 1/n share", () => {
    expect(shardConfig({ spend_ceiling_usd: 100 }, { index: 1, count: 4 })).toEqual({
      spend_ceiling_usd: 25,
    });
    expect(shardConfig({ spend_ceiling_usd: 100 }, undefined)).toEqual({ spend_ceiling_usd: 100 });
    expect(shardConfig({}, { index: 1, count: 4 })).toEqual({});
  });
});

describe("one process at a time writes a folder (RV1 backlog)", () => {
  const identity = { config: "x", fingerprint: "f" };

  test("a second journal on a folder is refused while the first is open, and the lock goes when it closes", () => {
    const dir = fresh();
    const first = openRunJournal(dir, { name: "x" }, { resume: false });
    expect(lockedBy(dir)).toEqual({ pid: process.pid, host: hostname() });
    expect(() => openRunJournal(dir, { name: "x" }, { resume: true })).toThrow(JournalLocked);
    first.close();
    expect(existsSync(join(dir, LOCK_FILE))).toBe(false);
    openRunJournal(dir, { name: "x" }, { resume: true }).close();
  });

  test("a lock left by a process of this host that is gone is taken over; another host's is not", () => {
    const dir = fresh();
    mkdirSync(dir, { recursive: true });
    // No process has this id: pids are well below 2^31 - 1 on every platform the runner supports.
    writeFileSync(join(dir, LOCK_FILE), JSON.stringify({ pid: 2 ** 31 - 2, host: hostname() }));
    expect(lockedBy(dir)).toBeUndefined();
    openRunJournal(dir, { name: identity.config }, { resume: false }).close();
    writeFileSync(join(dir, LOCK_FILE), JSON.stringify({ pid: 1, host: `not-${hostname()}` }));
    expect(() => openRunJournal(dir, { name: "x" }, { resume: false })).toThrow(
      /being written by process 1/,
    );
    writeFileSync(join(dir, LOCK_FILE), "{");
    expect(() => openRunJournal(dir, { name: "x" }, { resume: false })).toThrow(
      /naming no process/,
    );
  });
});

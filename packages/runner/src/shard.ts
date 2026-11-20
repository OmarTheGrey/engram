// A run split into shards (card RV6, design review RV-DES-10): `make run
// CONFIG=<file> SHARD=i/n` runs the i-th of n disjoint, deterministic slices
// of a config's sessions into its own output folder, so n processes can run
// at once on one machine or several, and `MERGE=n` joins the n folders into
// the one run `make h1-table` reads.
//
// - The slice is by item, so an item's conditions, stores and seeds stay in
//   one shard and H1's pairing never spans two. Shard i takes the i-th of n
//   contiguous blocks of the config's items in run order (items
//   floor((i-1)N/n) to floor(iN/n) - 1), so its rows are a contiguous run of
//   the unsharded run's rows, and the merge is the shards' files concatenated
//   in shard order: byte for byte the unsharded run's results, events and
//   summary, and its usage files too unless a shard crashed in the middle of
//   a session, whose resume replays that session's recorded calls as hits.
// - Nothing about a call depends on the shard: no cache key names it (a key is
//   the item, condition, preset, store, model, seed and prompt hash, ADR
//   0017), and the cassette directory is the config's, so every shard records
//   into and replays from the same cassettes as the unsharded run. Two shards
//   never record one key, since their items differ; a cassette is written to
//   a temporary file and renamed into place (fileCache), so shards sharing a
//   directory never see half a cassette.
// - The shard is in the run's fingerprint (journal.ts), beside the unsharded
//   fingerprint the merge checks, so a resume of shard i refuses another
//   shard's folder and the merge refuses shards of two configs.
// - A config's spend_ceiling_usd is the whole run's: each of n shards stops
//   when a provider's spend in that shard reaches the ceiling divided by n.
//   The check comes before each session, and a session started under it
//   finishes, so a run of n shards can pass the ceiling by up to n sessions'
//   cost (one per shard), where an unsharded run passes it by at most one.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AnyRunnerConfig } from "./config.ts";
import {
  LOCK_FILE,
  lockedBy,
  RUN_FILE,
  type RunIdentity,
  RunJournal,
  runFingerprint,
  SUMMARY_FILE,
  shardFingerprint,
} from "./journal.ts";

/** The i-th of n slices of a run, 1-based. */
export interface Shard {
  index: number;
  count: number;
}

export class ShardRefused extends Error {
  constructor(message: string) {
    super(`shard refused: ${message}`);
    this.name = "ShardRefused";
  }
}

/** `i/n` as a Shard: integers with 1 <= i <= n. */
export function parseShard(text: string): Shard {
  const match = /^(\d+)\/(\d+)$/.exec(text.trim());
  const index = Number(match?.[1]);
  const count = Number(match?.[2]);
  if (!match || !Number.isSafeInteger(index) || !Number.isSafeInteger(count)) {
    throw new ShardRefused(`${text} is not i/n (for example SHARD=2/4)`);
  }
  if (count < 1 || index < 1 || index > count) {
    throw new ShardRefused(`${text}: i must be between 1 and n, and n at least 1`);
  }
  return { index, count };
}

export const shardLabel = (shard: Shard): string => `${shard.index}/${shard.count}`;

/** Where shard i of n of the run whose merged folder is `out` writes: `<out>-shard-<i>-of-<n>`. */
export const shardDir = (out: string, shard: Shard): string =>
  `${out}-shard-${shard.index}-of-${shard.count}`;

/** Shard i of n of `items`, in order: the i-th of n contiguous blocks (all of them without a shard). */
export function shardSlice<T>(items: readonly T[], shard: Shard | undefined): T[] {
  if (shard === undefined) return [...items];
  if (shard.count > items.length) {
    throw new ShardRefused(
      `${shard.count} shards of ${items.length} items would leave a shard empty; use at most ${items.length}`,
    );
  }
  const start = Math.floor(((shard.index - 1) * items.length) / shard.count);
  const end = Math.floor((shard.index * items.length) / shard.count);
  return items.slice(start, end);
}

/** The config one shard runs: the run's ceiling split evenly over the shards (see the module comment). */
export function shardConfig<C extends Pick<AnyRunnerConfig, "spend_ceiling_usd">>(
  config: C,
  shard: Shard | undefined,
): C {
  if (shard === undefined || config.spend_ceiling_usd === undefined) return config;
  return { ...config, spend_ceiling_usd: config.spend_ceiling_usd / shard.count };
}

/**
 * The n shard folders of the run whose merged folder is `out`, checked for a
 * merge (card RV6): each is there, was written by shard k of n of this very
 * run (the config's name and the unsharded fingerprint), finished (its
 * summary.json is written and it did not stop at the spend ceiling), and is
 * not being written. Overlapping shards are refused when the merge reads
 * their rows (journal.ts). Returns the folders in shard order.
 */
export function checkShards(out: string, count: number, identity: RunIdentity): string[] {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new ShardRefused(`MERGE=${count}: the number of shards is a positive integer`);
  }
  const dirs: string[] = [];
  for (let index = 1; index <= count; index++) {
    const dir = shardDir(out, { index, count });
    const run = join(dir, RUN_FILE);
    if (!existsSync(run)) {
      throw new ShardRefused(
        `shard ${index}/${count} is missing: no ${run}; run it with SHARD=${index}/${count}`,
      );
    }
    const recorded = JSON.parse(readFileSync(run, "utf8")) as RunIdentity;
    if (recorded.config !== identity.config || recorded.unsharded !== identity.fingerprint) {
      throw new ShardRefused(
        `${dir} holds a run of ${recorded.config} (unsharded fingerprint ${recorded.unsharded ?? "none: not a shard"}), not of ${identity.config} as configured now (${identity.fingerprint}); every shard must be a shard of one config`,
      );
    }
    if (recorded.shard?.index !== index || recorded.shard.count !== count) {
      throw new ShardRefused(
        `${dir} holds shard ${recorded.shard ? `${recorded.shard.index}/${recorded.shard.count}` : "none"}, not ${index}/${count}`,
      );
    }
    const holder = lockedBy(dir);
    if (holder !== undefined) {
      throw new ShardRefused(
        `shard ${index}/${count} is still being written (${join(dir, LOCK_FILE)}); merge once it ends`,
      );
    }
    const summary = join(dir, SUMMARY_FILE);
    if (!existsSync(summary)) {
      throw new ShardRefused(
        `shard ${index}/${count} did not finish (no ${SUMMARY_FILE} in ${dir}); resume it with SHARD=${index}/${count} RESUME=1`,
      );
    }
    const { stopped } = JSON.parse(readFileSync(summary, "utf8")) as { stopped?: unknown };
    if (stopped !== undefined) {
      throw new ShardRefused(
        `shard ${index}/${count} stopped at the spend ceiling; raise spend_ceiling_usd and resume it with SHARD=${index}/${count} RESUME=1`,
      );
    }
    dirs.push(dir);
  }
  return dirs;
}

export interface RunJournalOptions {
  /** Continue the run already in the folder (RESUME=1). */
  resume: boolean;
  /** This folder is shard `shard` of the run. */
  shard?: Shard;
  /** Merge this many shard folders of `out` into it. */
  merge?: number;
  /** GateMem's events.jsonl. */
  sidecar?: string;
  /**
   * The config's items, in run order: with a shard, its slice is checked
   * before any folder is made, so a shard count above the item count leaves
   * nothing behind (review P60-7).
   */
  items?: readonly string[];
}

/**
 * The journal of a session run of `config` into `out`: afresh or resumed
 * (card RV1); a shard's, its identity naming the shard beside the unsharded
 * fingerprint; or a merge's, sealed over the checked shard folders of `out`.
 */
export function openRunJournal(
  out: string,
  config: object & { name: string },
  options: RunJournalOptions,
): RunJournal {
  const unsharded: RunIdentity = { config: config.name, fingerprint: runFingerprint(config) };
  const sidecar = options.sidecar === undefined ? {} : { sidecar: options.sidecar };
  if (options.merge !== undefined) {
    const merge = checkShards(out, options.merge, unsharded);
    return RunJournal.open(out, { identity: unsharded, resume: true, merge, ...sidecar });
  }
  if (options.shard && options.items) shardSlice(options.items, options.shard);
  const identity: RunIdentity = options.shard
    ? {
        ...unsharded,
        fingerprint: shardFingerprint(unsharded.fingerprint, options.shard),
        shard: options.shard,
        unsharded: unsharded.fingerprint,
      }
    : unsharded;
  return RunJournal.open(out, { identity, resume: options.resume, ...sidecar });
}

/**
 * After the runner's pass over a merged folder: its rows are every session
 * of the config, once, in its order, and run.json is written; otherwise it
 * throws, and closing the journal removes every merged file (review P60-3),
 * so no later run takes the folder for this one.
 */
export function sealMerge(journal: RunJournal): void {
  journal.checkSealed();
}

// A run's journal (card RV1; review findings RV-EXP-1, RV-EXP-2, RV-EXP-4):
// each session's row is appended to results.jsonl the moment the session
// ends, and each model call's usage to usage.jsonl the moment the call
// returns, so a run that crashes, or stops at a spend ceiling, keeps every
// session it finished and every call it paid for. A rerun with `resume`
// reads the folder back, cuts a line a crash left half written, skips the
// sessions already there, and appends the rest in config order, so the
// resumed results.jsonl is byte for byte the one an uninterrupted run
// writes.
//
// Nothing here builds a whole file as one string, or reads one back as one
// (V8's string limit is 2^29 - 24 characters, and H1's GateMem results reach
// about 540 million at the full set's mean sizes, RV-EXP-2): rows are written
// one line at a time and read one line at a time (`forEachJsonl`). A row's
// bulky part may go to a sidecar file, one line per row in the same order
// (GateMem's plane log, events.jsonl).
//
// The folder records which config wrote it (run.json, a fingerprint of the
// config without its paths and its spend ceiling), and a resume refuses a
// folder another config wrote. Raising the ceiling and resuming is how a
// stopped sweep continues.
//
// A shard's folder (card RV6, shard.ts) records its shard and the unsharded
// run's fingerprint beside its own, which names the shard. A merged folder is
// sealed: the shards' files concatenated in shard order, then read back as a
// resumed run in which every session must already be there, in the order the
// config runs them; a sealed journal records no row and no call, so the
// runner's pass over it only rewrites summary.json and usage.json.
//
// One process at a time writes a folder (card RV6, the RV1 backlog): the
// journal holds run.lock in it, naming its process and host, until it is
// closed. A second journal on the folder is refused while that process
// lives; a lock left by a process of this host that is gone is taken over.

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  truncateSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "@engram/core";
import type { UsageRecord } from "@engram/model";
import type { Shard } from "./shard.ts";

/** What names one session of a run: every row of every benchmark carries these fields. */
export interface SessionKey {
  item: string;
  condition: string;
  store: string;
  seed: number;
}

export const sessionId = (k: SessionKey): string =>
  JSON.stringify([k.item, k.condition, k.store, k.seed]);

export const RESULTS_FILE = "results.jsonl";
export const USAGE_LOG = "usage.jsonl";
export const RUN_FILE = "run.json";
export const SUMMARY_FILE = "summary.json";
export const USAGE_FILE = "usage.json";
/** Held in a run's folder while a process writes it (card RV6). */
export const LOCK_FILE = "run.lock";

const NEWLINE = 0x0a;
const CHUNK = 1 << 20;

/**
 * Each complete line of a JSON Lines file, parsed, in order, read in chunks
 * so no file is ever one string. A last line without its newline (a write a
 * crash cut short) is not read. Returns the bytes of the complete lines and
 * how many there were.
 */
export function forEachJsonl<T = unknown>(
  path: string,
  fn: (value: T, index: number) => void,
): { bytes: number; lines: number } {
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.allocUnsafe(CHUNK);
    let pending: Buffer[] = [];
    let bytes = 0;
    let lines = 0;
    for (;;) {
      const n = readSync(fd, buffer, 0, CHUNK, null);
      if (n === 0) break;
      let start = 0;
      for (
        let i = buffer.indexOf(NEWLINE, 0);
        i !== -1 && i < n;
        i = buffer.indexOf(NEWLINE, i + 1)
      ) {
        const piece = buffer.subarray(start, i);
        const line = pending.length === 0 ? piece : Buffer.concat([...pending, piece]);
        pending = [];
        bytes += line.length + 1;
        start = i + 1;
        const text = line.toString("utf8");
        if (text.trim() !== "") fn(JSON.parse(text) as T, lines);
        lines++;
      }
      if (start < n) pending.push(Buffer.from(buffer.subarray(start, n)));
    }
    return { bytes, lines };
  } finally {
    closeSync(fd);
  }
}

/** The byte offset just after the `count`-th newline of `path`, or undefined when it has fewer lines. */
function afterLines(path: string, count: number): number | undefined {
  if (count === 0) return 0;
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.allocUnsafe(CHUNK);
    let offset = 0;
    let seen = 0;
    for (;;) {
      const n = readSync(fd, buffer, 0, CHUNK, null);
      if (n === 0) return undefined;
      for (
        let i = buffer.indexOf(NEWLINE, 0);
        i !== -1 && i < n;
        i = buffer.indexOf(NEWLINE, i + 1)
      ) {
        if (++seen === count) return offset + i + 1;
      }
      offset += n;
    }
  } finally {
    closeSync(fd);
  }
}

/** Rows one line at a time into `path`, never the whole file as one string. */
export function writeJsonl(path: string, rows: Iterable<unknown>): void {
  const fd = openSync(path, "w");
  try {
    for (const row of rows) writeSync(fd, `${JSON.stringify(row)}\n`);
  } finally {
    closeSync(fd);
  }
}

/** The fields of a config that do not change what its sessions are: its cassettes, and the spend ceiling. */
const UNFINGERPRINTED = new Set(["cassettes", "spend_ceiling_usd"]);

/** A script as its path and the sha256 of its contents, so a script edited in place is another run. */
const scriptPrint = (path: unknown) =>
  typeof path === "string" && existsSync(path)
    ? { path, sha256: sha256(readFileSync(path, "utf8").replaceAll("\r\n", "\n")) }
    : path;

/**
 * A fingerprint of what a config runs: every field but its cassettes (a live
 * run and its replay share a folder, and the cassettes move between
 * machines) and its spend ceiling (raised to continue a stopped sweep). The
 * data folder and the scripts are in it, a script by its contents as well
 * as its path, so a resume never mixes rows of two scripts or two data sets
 * (review RV1-7).
 */
export function runFingerprint(config: object): string {
  const kept = Object.fromEntries(
    Object.entries(config).flatMap(([k, v]): [string, unknown][] => {
      if (UNFINGERPRINTED.has(k) || v === undefined) return [];
      if (k === "script") return [[k, scriptPrint(v)]];
      if (k === "judge" && v && typeof v === "object") {
        const judge = v as Record<string, unknown>;
        return [
          [
            k,
            {
              ...judge,
              ...(judge.script === undefined ? {} : { script: scriptPrint(judge.script) }),
            },
          ],
        ];
      }
      return [[k, v]];
    }),
  );
  return sha256(canonicalJson(kept));
}

export class JournalMismatch extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JournalMismatch";
  }
}

/** What run.json records of the run that wrote a folder. */
export interface RunIdentity {
  config: string;
  /** runFingerprint of what the folder's run runs; a shard's names its shard. */
  fingerprint: string;
  /** A shard's folder: which shard (card RV6). */
  shard?: Shard;
  /** A shard's folder: the fingerprint of the unsharded run, which every shard of one run shares. */
  unsharded?: string;
}

/** The fingerprint of shard `shard` of the run whose fingerprint is `unsharded`. */
export const shardFingerprint = (unsharded: string, shard: Shard): string =>
  sha256(canonicalJson({ unsharded, shard }));

export interface JournalOptions {
  /** The run's identity (runFingerprint); a resume refuses a folder another config, or another shard, wrote. */
  identity: RunIdentity;
  /** Continue the run already in the folder; otherwise the folder's run files are removed first. */
  resume: boolean;
  /** A sidecar file beside results.jsonl, one line per row in the same order (GateMem's events.jsonl). */
  sidecar?: string;
  /**
   * The shard folders of this run, in shard order (card RV6): the folder is
   * made afresh from their files concatenated and opened sealed (see the
   * module comment). `identity` is the unsharded run's.
   */
  merge?: readonly string[];
  /** Reads a lock holder's start time (review P60-R2); a test injects it. */
  startOf?: StartReader;
}

export class JournalLocked extends JournalMismatch {
  constructor(message: string) {
    super(message);
    this.name = "JournalLocked";
  }
}

interface LockHolder {
  pid: number;
  host: string;
  /** When the holder's process started, in ms since the epoch (review P60-8); absent in an older lock. */
  started?: number;
  /** A random id of this lock, so a takeover can tell the lock it read from one taken since. */
  nonce?: string;
}

/** A start time read back for the same process may differ by clock rounding and the query's own time. */
const START_SLACK_MS = 2_000;

/** This process's start time, in ms since the epoch. */
const OWN_START = Math.round(Date.now() - performance.now());

/** Reads when process `pid` of this host started, in ms since the epoch; undefined when it cannot. */
export type StartReader = (pid: number) => number | undefined;

/** Clock ticks per second in /proc/<pid>/stat; 100 on every Linux the runner supports. */
const CLOCK_TICKS = 100;

/**
 * A process start from the text of /proc/<pid>/stat and the boot time
 * (btime of /proc/stat, in seconds): field 22 is the start in clock ticks
 * since boot. The command name (field 2) may hold spaces and parentheses,
 * so the fields are counted from the last closing parenthesis.
 */
export function parseProcStat(stat: string, btimeSeconds: number): number | undefined {
  const close = stat.lastIndexOf(")");
  if (close < 0) return undefined;
  const ticks = Number(
    stat
      .slice(close + 1)
      .trim()
      .split(/\s+/)[19],
  );
  return Number.isFinite(ticks)
    ? btimeSeconds * 1000 + Math.round((ticks * 1000) / CLOCK_TICKS)
    : undefined;
}

/** An absolute start time, never an age subtracted from the clock (review P60-R2). */
function readStart(pid: number): number | undefined {
  if (process.platform === "win32") {
    const out = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `$p = Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}'; if ($p) { [DateTimeOffset]::new($p.CreationDate).ToUnixTimeMilliseconds() }`,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 30_000 },
    ).trim();
    return out === "" ? undefined : Number(out);
  }
  if (existsSync("/proc/self/stat")) {
    const btime = /^btime (\d+)$/m.exec(readFileSync("/proc/stat", "utf8"));
    return btime === null
      ? undefined
      : parseProcStat(readFileSync(`/proc/${pid}/stat`, "utf8"), Number(btime[1]));
  }
  const out = execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 10_000,
    env: { ...process.env, LC_ALL: "C" },
  }).trim();
  const at = out === "" ? Number.NaN : Date.parse(out);
  return Number.isFinite(at) ? at : undefined;
}

/**
 * When process `pid` of this host started, in ms since the epoch, or
 * undefined when it is not running or the start cannot be read.
 */
export function processStart(pid: number): number | undefined {
  if (pid === process.pid) return OWN_START;
  try {
    return readStart(pid);
  } catch {
    return undefined;
  }
}

/** Whether process `pid` of this host is running. */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** The holder a lock file names, or undefined when it names none readable. */
function lockHolder(path: string): LockHolder | undefined {
  try {
    const holder = JSON.parse(readFileSync(path, "utf8")) as Partial<LockHolder>;
    return typeof holder.pid === "number" && typeof holder.host === "string"
      ? {
          pid: holder.pid,
          host: holder.host,
          ...(typeof holder.started === "number" ? { started: holder.started } : {}),
          ...(typeof holder.nonce === "string" ? { nonce: holder.nonce } : {}),
        }
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether the process a lock names is gone: a process of this host that is
 * not running, or (review P60-8) one whose pid now belongs to a process
 * started at another time than the lock records. A start time that cannot
 * be read counts as the holder's, so an unreadable process keeps its lock.
 */
function gone(holder: LockHolder, startOf: StartReader): boolean {
  if (holder.host !== hostname() || holder.pid === process.pid) return false;
  if (!alive(holder.pid)) return true;
  if (holder.started === undefined) return false;
  const started = startOf(holder.pid);
  return started !== undefined && Math.abs(started - holder.started) > START_SLACK_MS;
}

/** Who holds `dir`'s lock: a live process (or one of another host), "unknown", or nobody. */
export function lockedBy(
  dir: string,
  startOf: StartReader = processStart,
): LockHolder | "unknown" | undefined {
  const path = join(dir, LOCK_FILE);
  if (!existsSync(path)) return undefined;
  const holder = lockHolder(path);
  if (holder === undefined) return "unknown";
  return gone(holder, startOf) ? undefined : holder;
}

/**
 * Take `dir`'s lock (see the module comment); returns the lock file's path.
 * A stale lock is taken over atomically (review P60-8): it is renamed to a
 * name of this attempt's own, which only one process can do, and the renamed
 * file must still be the stale lock that was judged gone; if another process
 * replaced it in between, it is put back and the lock is refused.
 */
function acquireLock(dir: string, startOf: StartReader): string {
  const path = join(dir, LOCK_FILE);
  const mine = { pid: process.pid, host: hostname(), started: OWN_START, nonce: randomUUID() };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const fd = openSync(path, "wx");
      try {
        writeSync(fd, `${JSON.stringify(mine)}\n`);
      } finally {
        closeSync(fd);
      }
      return path;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      const seen = lockHolder(path);
      if (seen !== undefined && gone(seen, startOf)) {
        const aside = `${path}.stale-${mine.nonce}`;
        try {
          renameSync(path, aside);
        } catch {
          continue; // another process moved it first; look again
        }
        const moved = lockHolder(aside);
        if (moved !== undefined && moved.nonce === seen.nonce && moved.pid === seen.pid) {
          rmSync(aside, { force: true });
          continue;
        }
        // Not the lock judged gone: give it back where it was.
        try {
          linkSync(aside, path);
        } catch {
          // The place is taken again; the lock in it is someone's, so refuse below.
        }
        rmSync(aside, { force: true });
      }
      const holder = lockedBy(dir, startOf) ?? seen ?? "unknown";
      throw new JournalLocked(
        holder === "unknown"
          ? `${dir} holds ${LOCK_FILE} naming no process: another run may be writing it; if none is, remove ${path}`
          : `${dir} is being written by process ${holder.pid} on ${holder.host} (${path}); two runs never write one folder. Give this run another --out, or wait for that one to end`,
      );
    }
  }
  throw new JournalLocked(`${dir}: could not take ${path}`);
}

/** `sources` one after another into `target`, a chunk at a time; each must end with a newline. */
function concatenate(target: string, sources: readonly string[]): void {
  const out = openSync(target, "w");
  try {
    const buffer = Buffer.allocUnsafe(CHUNK);
    for (const source of sources) {
      if (!existsSync(source)) continue;
      const fd = openSync(source, "r");
      try {
        let last = NEWLINE;
        for (;;) {
          const n = readSync(fd, buffer, 0, CHUNK, null);
          if (n === 0) break;
          writeSync(out, buffer, 0, n);
          last = buffer[n - 1] as number;
        }
        if (last !== NEWLINE) {
          throw new JournalMismatch(`${source} ends in half a line; resume its shard first`);
        }
      } finally {
        closeSync(fd);
      }
    }
  } finally {
    closeSync(out);
  }
}

/** The journal of one run's output folder (see the module comment). */
export class RunJournal {
  readonly dir: string;
  /** Usage of every call the run made, earlier invocations' included: the spend ledger. */
  readonly ledger: UsageRecord[] = [];
  /** How many sessions an earlier invocation finished. */
  readonly resumed: number;
  /** A merged folder (card RV6): every session is already in it, and nothing is recorded. */
  readonly sealed: boolean;
  private readonly done = new Set<string>();
  /** A sealed folder's sessions in file order, and those the runner asked about, in its order. */
  private readonly order: string[] = [];
  private readonly visited: string[] = [];
  private readonly sidecar: string | undefined;
  private results: number | undefined;
  private side: number | undefined;
  private usage: number | undefined;
  private lock: string | undefined;
  /** A merge's: the shard folders' locks, held while it reads them (review P60-8). */
  private shardLocks: string[] = [];
  /** A merge's identity, written to run.json once the merged rows are sealed (review P60-3). */
  private readonly identity: RunIdentity;
  private sealedOk = false;
  /** Set once a merge starts writing the folder: only then does closing remove its files (review P60-R3). */
  private mergeWriting = false;

  private constructor(dir: string, options: JournalOptions) {
    this.dir = dir;
    this.sidecar = options.sidecar;
    this.sealed = options.merge !== undefined;
    this.identity = options.identity;
    mkdirSync(dir, { recursive: true });
    const startOf = options.startOf ?? processStart;
    this.lock = acquireLock(dir, startOf);
    try {
      for (const shard of options.merge ?? []) this.shardLocks.push(acquireLock(shard, startOf));
      this.openFolder(options);
    } catch (e) {
      this.close();
      throw e;
    }
    this.resumed = this.done.size;
  }

  private openFolder(options: JournalOptions): void {
    const dir = this.dir;
    const files = [RESULTS_FILE, USAGE_LOG, RUN_FILE, SUMMARY_FILE, USAGE_FILE];
    if (options.sidecar) files.push(options.sidecar);
    const results = join(dir, RESULTS_FILE);
    const run = join(dir, RUN_FILE);
    if (options.merge) {
      this.mergeWriting = true;
      for (const f of files) rmSync(join(dir, f), { force: true });
      const logs = [RESULTS_FILE, USAGE_LOG, ...(options.sidecar ? [options.sidecar] : [])];
      for (const f of logs) {
        concatenate(
          join(dir, f),
          options.merge.map((shard) => join(shard, f)),
        );
      }
      // run.json is written only once checkSealed passes (review P60-3): a
      // refused merge leaves no run that a resume would take for this one.
      this.readBack();
    } else if (options.resume && existsSync(run)) {
      const recorded = JSON.parse(readFileSync(run, "utf8")) as RunIdentity;
      if (
        recorded.config !== options.identity.config ||
        recorded.fingerprint !== options.identity.fingerprint
      ) {
        throw new JournalMismatch(
          `${dir} holds a run of ${recorded.config} with another config (fingerprint ${recorded.fingerprint}, not ${options.identity.fingerprint}); resume it with the config that wrote it, or write to another folder`,
        );
      }
      this.readBack();
    } else if (options.resume && existsSync(results)) {
      throw new JournalMismatch(
        `${dir} holds results with no ${RUN_FILE} naming the config that wrote them; it cannot be resumed`,
      );
    } else {
      for (const f of files) rmSync(join(dir, f), { force: true });
      writeFileSync(run, `${JSON.stringify(options.identity, null, 2)}\n`);
    }
    if (this.sealed) return;
    this.results = openSync(results, "a");
    this.usage = openSync(join(dir, USAGE_LOG), "a");
    if (options.sidecar) this.side = openSync(join(dir, options.sidecar), "a");
  }

  /** Open `dir`'s journal: afresh, or (`resume`) continuing the run it holds. */
  static open(dir: string, options: JournalOptions): RunJournal {
    return new RunJournal(dir, options);
  }

  /** Read the finished sessions and the ledger back, cutting a line a crash left half written. */
  private readBack(): void {
    const results = join(this.dir, RESULTS_FILE);
    if (existsSync(results)) {
      const { bytes } = forEachJsonl<SessionKey>(results, (row) => {
        const id = sessionId(row);
        if (this.sealed) {
          if (this.done.has(id)) {
            throw new JournalMismatch(`session ${id} is in two shards; the shards overlap`);
          }
          this.order.push(id);
        }
        this.done.add(id);
      });
      truncateSync(results, bytes);
    }
    if (this.sidecar) {
      const path = join(this.dir, this.sidecar);
      // The sidecar line is written before its row, so it holds as many lines
      // as results.jsonl, or one more when a crash fell between the two.
      const end = existsSync(path)
        ? afterLines(path, this.done.size)
        : this.done.size === 0
          ? 0
          : undefined;
      if (end === undefined) {
        throw new JournalMismatch(
          `${path} holds fewer lines than ${RESULTS_FILE}'s ${this.done.size} rows; the folder cannot be resumed`,
        );
      }
      if (existsSync(path)) truncateSync(path, end);
    }
    const usage = join(this.dir, USAGE_LOG);
    if (existsSync(usage)) {
      const { bytes } = forEachJsonl<UsageRecord>(usage, (u) => {
        this.ledger.push(u);
      });
      truncateSync(usage, bytes);
    }
  }

  /** Whether an earlier invocation finished this session. A sealed folder must hold every session asked about. */
  has(key: SessionKey): boolean {
    const id = sessionId(key);
    if (!this.sealed) return this.done.has(id);
    if (!this.done.has(id)) {
      throw new JournalMismatch(
        `session ${id} of the config is in none of the shards; a shard is missing or ran another slice`,
      );
    }
    if (this.visited.at(-1) !== id) this.visited.push(id);
    return true;
  }

  /**
   * A sealed folder after the runner's pass: every row in it is a session of
   * the config, once, in the order the config runs them, so the merged files
   * are the unsharded run's.
   */
  checkSealed(): void {
    if (!this.sealed) return;
    const asked = new Set(this.visited);
    const extra = this.order.filter((id) => !asked.has(id)).length;
    if (extra > 0) {
      throw new JournalMismatch(
        `the shards hold ${extra} sessions the config does not run; they are not shards of this run`,
      );
    }
    const firstAsked = [...asked];
    const at = this.order.findIndex((id, i) => firstAsked[i] !== id);
    if (at !== -1) {
      throw new JournalMismatch(
        `the shards' sessions are not in the config's order (first at row ${at + 1}); merge the shards in shard order`,
      );
    }
    writeFileSync(join(this.dir, RUN_FILE), `${JSON.stringify(this.identity, null, 2)}\n`);
    this.sealedOk = true;
  }

  /** How many sessions the folder holds. */
  get sessions(): number {
    return this.done.size;
  }

  /** One call's usage, appended the moment it is known (a sealed folder's pass records none). */
  recordUsage(usage: UsageRecord): void {
    if (this.sealed) return;
    this.ledger.push(usage);
    writeSync(this.usage as number, `${JSON.stringify(usage)}\n`);
  }

  /** One finished session: its sidecar line first, then its row, so a row never lacks its sidecar. */
  append(key: SessionKey, row: unknown, sidecar?: unknown): void {
    if (this.sealed) {
      throw new JournalMismatch(`a merged folder takes no new session (${sessionId(key)})`);
    }
    if (this.side !== undefined) writeSync(this.side, `${JSON.stringify(sidecar ?? null)}\n`);
    writeSync(this.results as number, `${JSON.stringify(row)}\n`);
    this.done.add(sessionId(key));
  }

  /** Every row in the folder, earlier invocations' included, in order, one line at a time. */
  forEachRow<T>(fn: (row: T) => void): void {
    const results = join(this.dir, RESULTS_FILE);
    if (existsSync(results)) forEachJsonl<T>(results, fn);
  }

  /** A JSON file of the run (summary.json, usage.json), written whole: these stay small. */
  writeJson(name: string, value: unknown): void {
    writeFileSync(join(this.dir, name), `${JSON.stringify(value, null, 2)}\n`);
  }

  close(): void {
    for (const fd of [this.results, this.side, this.usage]) if (fd !== undefined) closeSync(fd);
    this.results = this.side = this.usage = undefined;
    if (this.mergeWriting && !this.sealedOk && this.lock !== undefined) {
      // A merge that did not seal (refused, or the pass failed): none of its files stay (review P60-3).
      const files = [RESULTS_FILE, USAGE_LOG, RUN_FILE, SUMMARY_FILE, USAGE_FILE];
      if (this.sidecar) files.push(this.sidecar);
      for (const f of files) rmSync(join(this.dir, f), { force: true });
    }
    for (const lock of this.shardLocks) rmSync(lock, { force: true });
    this.shardLocks = [];
    if (this.lock !== undefined) rmSync(this.lock, { force: true });
    this.lock = undefined;
  }
}

/** The provider part of `provider/model-id`. */
export const providerOf = (model: string): string => model.split("/")[0] ?? "";

/** What the paid calls of a ledger cost, by provider (a hit spends nothing). */
export function spentByProvider(usage: readonly UsageRecord[]): Map<string, number> {
  const spent = new Map<string, number>();
  for (const u of usage) {
    if (u.hit) continue;
    const p = providerOf(u.model);
    spent.set(p, (spent.get(p) ?? 0) + u.cost_usd);
  }
  return spent;
}

/** Why a run stopped before its last session (RV-EXP-4). */
export interface Stopped {
  reason: "spend ceiling";
  provider: string;
  spent_usd: number;
  ceiling_usd: number;
}

const usd = (x: number) => Math.round(x * 1e6) / 1e6;

/** The first provider whose spend reached `ceiling`, if any (each provider has the same ceiling). */
export function overCeiling(
  usage: readonly UsageRecord[],
  ceiling: number | undefined,
): Stopped | undefined {
  if (ceiling === undefined) return undefined;
  for (const [provider, spent] of [...spentByProvider(usage)].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    if (spent >= ceiling) {
      return { reason: "spend ceiling", provider, spent_usd: usd(spent), ceiling_usd: ceiling };
    }
  }
  return undefined;
}

/**
 * Where a runner's sessions go: into a journal (a run with an output folder)
 * or into memory (`rows`, for a caller that writes them itself). Before each
 * session `proceed` checks the spend ledger against the ceiling; `commit`
 * hands each finished row on.
 */
export class SessionSink<R extends SessionKey> {
  /** The rows of this invocation, when there is no journal. */
  readonly rows: R[] = [];
  /** Usage of this invocation's calls. */
  readonly usage: UsageRecord[] = [];
  stopped: Stopped | undefined;
  private readonly journal: RunJournal | undefined;
  private readonly ceiling: number | undefined;
  private readonly split: ((row: R) => { row: unknown; sidecar?: unknown }) | undefined;
  private readonly onRow: ((row: R) => void) | undefined;

  constructor(options: {
    journal?: RunJournal | undefined;
    ceiling?: number | undefined;
    split?: ((row: R) => { row: unknown; sidecar?: unknown }) | undefined;
    onRow?: ((row: R) => void) | undefined;
  }) {
    this.journal = options.journal;
    this.ceiling = options.ceiling;
    this.split = options.split;
    this.onRow = options.onRow;
  }

  /** Records one call's usage (to the journal's ledger as well, at once). */
  readonly onUsage = (u: UsageRecord): void => {
    this.usage.push(u);
    this.journal?.recordUsage(u);
  };

  /** Whether an earlier invocation finished this session. */
  done(key: SessionKey): boolean {
    return this.journal?.has(key) ?? false;
  }

  /** Whether the next session may start: not once a provider's spend has reached the ceiling. */
  proceed(): boolean {
    this.stopped ??= overCeiling(this.journal?.ledger ?? this.usage, this.ceiling);
    return this.stopped === undefined;
  }

  /** A finished session: kept (in the journal, or in memory) first, then handed to `onRow`. */
  commit(row: R): void {
    if (this.journal) {
      const parts = this.split ? this.split(row) : { row };
      this.journal.append(row, parts.row, parts.sidecar);
    } else {
      this.rows.push(row);
    }
    this.onRow?.(row);
  }

  /** Every row of the run, in order: the journal's, read back one line at a time, or this invocation's. */
  forEachRow(fn: (row: R) => void): void {
    if (this.journal) this.journal.forEachRow(fn);
    else for (const r of this.rows) fn(r);
  }

  /** Rows in the run, earlier invocations' included. */
  get sessions(): number {
    return this.journal ? this.journal.sessions : this.rows.length;
  }

  get resumed(): number {
    return this.journal?.resumed ?? 0;
  }

  /** The run's whole ledger: the journal's (every invocation), or this invocation's. */
  get ledger(): UsageRecord[] {
    return this.journal?.ledger ?? this.usage;
  }
}

/** New and cached calls in a ledger. */
export const callCounts = (usage: readonly UsageRecord[]) => ({
  new: usage.filter((u) => !u.hit).length,
  cached: usage.filter((u) => u.hit).length,
});

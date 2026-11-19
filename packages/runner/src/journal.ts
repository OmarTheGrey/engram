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
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  truncateSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { join } from "node:path";
import { canonicalJson, sha256 } from "@engram/core";
import type { UsageRecord } from "@engram/model";

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

/** The fields of a config that do not change what its sessions are: paths, and the spend ceiling. */
const UNFINGERPRINTED = new Set(["data", "cassettes", "script", "spend_ceiling_usd"]);

/**
 * A fingerprint of what a config runs: every field but its paths (which
 * differ between machines and between a live run and its replay) and its
 * spend ceiling (raised to continue a stopped sweep).
 */
export function runFingerprint(config: object): string {
  const kept = Object.fromEntries(
    Object.entries(config).flatMap(([k, v]): [string, unknown][] => {
      if (UNFINGERPRINTED.has(k) || v === undefined) return [];
      if (k === "judge" && v && typeof v === "object") {
        const { script: _script, ...judge } = v as Record<string, unknown>;
        return [[k, judge]];
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

export interface JournalOptions {
  /** The config's name and fingerprint (runFingerprint); a resume refuses a folder another config wrote. */
  identity: { config: string; fingerprint: string };
  /** Continue the run already in the folder; otherwise the folder's run files are removed first. */
  resume: boolean;
  /** A sidecar file beside results.jsonl, one line per row in the same order (GateMem's events.jsonl). */
  sidecar?: string;
}

/** The journal of one run's output folder (see the module comment). */
export class RunJournal {
  readonly dir: string;
  /** Usage of every call the run made, earlier invocations' included: the spend ledger. */
  readonly ledger: UsageRecord[] = [];
  /** How many sessions an earlier invocation finished. */
  readonly resumed: number;
  private readonly done = new Set<string>();
  private readonly sidecar: string | undefined;
  private results: number | undefined;
  private side: number | undefined;
  private usage: number | undefined;

  private constructor(dir: string, options: JournalOptions) {
    this.dir = dir;
    this.sidecar = options.sidecar;
    mkdirSync(dir, { recursive: true });
    const files = [RESULTS_FILE, USAGE_LOG, RUN_FILE, SUMMARY_FILE, USAGE_FILE];
    if (options.sidecar) files.push(options.sidecar);
    const results = join(dir, RESULTS_FILE);
    const run = join(dir, RUN_FILE);
    if (options.resume && existsSync(run)) {
      const recorded = JSON.parse(readFileSync(run, "utf8")) as JournalOptions["identity"];
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
    this.resumed = this.done.size;
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
        this.done.add(sessionId(row));
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

  /** Whether an earlier invocation finished this session. */
  has(key: SessionKey): boolean {
    return this.done.has(sessionId(key));
  }

  /** How many sessions the folder holds. */
  get sessions(): number {
    return this.done.size;
  }

  /** One call's usage, appended the moment it is known. */
  recordUsage(usage: UsageRecord): void {
    this.ledger.push(usage);
    writeSync(this.usage as number, `${JSON.stringify(usage)}\n`);
  }

  /** One finished session: its sidecar line first, then its row, so a row never lacks its sidecar. */
  append(key: SessionKey, row: unknown, sidecar?: unknown): void {
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

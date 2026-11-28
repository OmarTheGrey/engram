// The paired fault-injection check for H3 (card X18, proposal U6 of the
// pre-registration, unregistered): governance-state faults on a LongMemEval
// memory state built as card B5 builds it, with the clean, corrupted and
// enforced reads compared. Model-free: no model is called, the lints are the
// deterministic tier only. After Governance-State Corruption (2610.30698,
// paper, idea only; docs/readings/litreview/2610.30698-governance-state-corruption.md).
//
// The base. B5's write phase (longmemeval/plane.ts writePhase) through the
// Plane at preset medium on the fake store, read as C5 reads: the core
// retrieval pipeline at READ_LIMIT (20), by the user, with the question as the
// query, at B5's read time (readTime). The log keeps the hash chain (card E1.6),
// salts drawn from the config's seed, so `engram log verify`'s check
// (verifyChain) can be asked about an edited event; B5's own runs keep none,
// and nothing here reaches them. B5's state holds no superseded version, so
// the clean state adds one governed supersession: an item of B5's read,
// drawn by the seed, closed at the read time by a governed update (the new
// version supersede.ts's closedVersion writes, through Plane.write). The
// clean read is the read after it.
//
// The faults: three operators (deletion, temporal supersession, missing
// metadata) at two places (the projection, the log intact; the log, one
// event body edited), one fault per base, operator and place, each on its
// own copy of the clean log. The target of deletion and missing metadata is
// drawn from the clean read; that of supersession is the closed item.
//
// The reads, per pair. Clean: the clean read. Corrupted: the same read over
// the corrupted state; for a log fault, over the projection replayed from the
// edited log (rebuild), since that is the state any handle that replays the
// log holds. Enforced: for a projection fault, the projection rebuilt from
// the log, then the read, so its recovery holds by construction (a check of
// the replay property, not evidence for H3); for a log fault, the
// deterministic lints the preset enables (Plane.lint), then the read. Beside
// them: whether a lint raised a finding on the target that the clean state
// does not have, and verifyChain's verdict on the corrupted log.
//
// Seeds: every draw comes from a stream seeded by the config's seed and the
// question id, so a base's pairs do not depend on which other bases the run
// holds. Ids are sequential per base. Nothing here reads a clock.
import { createHash } from "node:crypto";
import { createFakeAdapter } from "@engram/adapters";
import {
  type Actor,
  createPlane,
  type Db,
  keepChain,
  type LintFinding,
  loadPreset,
  type MemoryEvent,
  type MemoryItem,
  migrate,
  openSqlite,
  type Plane,
  type Policy,
  rebuild,
  type Verdict,
  verifyChain,
} from "@engram/core";
import { readTime, USER, userActor, writePhase } from "../longmemeval/plane.ts";
import type { VisibleQuestion } from "../longmemeval/strip.ts";

export const OPERATORS = ["deletion", "temporal-supersession", "missing-metadata"] as const;
export type Operator = (typeof OPERATORS)[number];
export const PLACES = ["projection", "log"] as const;
export type Place = (typeof PLACES)[number];

/**
 * The lint that checks the field each operator corrupts: a finding by it on
 * the target that the clean state lacks is a detection. A new finding by any
 * other lint is counted (`new_lint_ids`) but is no detection: restoring a
 * closed version makes it readable again, so the lints reach it and raise its
 * natural findings (an assistant turn's missing model), which say nothing of
 * the fault (decision entry docs/log/2026-11-28-x18-decision-lint-detection.md).
 */
export const DETECTING_LINT: Readonly<Record<Operator, string>> = {
  deletion: "orphan",
  "temporal-supersession": "expired-validity",
  "missing-metadata": "missing-provenance",
};

/** B5's preset for C5 (research/configs/b5-longmemeval-plane.json). */
export const PRESET = "medium";
/** The read limit every condition shares (packages/runner/src/conditions.ts READ_LIMIT). */
export const READ_LIMIT = 20;

export interface CheckOptions {
  seed: number;
}

/** One pair: one fault at one place, and what the three reads and the two detectors said. */
export interface PairOutcome {
  operator: Operator;
  place: Place;
  /** Whether the base had an item to fault (an empty read has none). */
  targeted: boolean;
  /** The faulted item's id (a sequential id of this base, no content), or null. */
  target: string | null;
  /** The corrupted read's ids and order differ from the clean read's. */
  changed: boolean;
  /** The enforced read's ids and order equal the clean read's. */
  enforced_equals_clean: boolean;
  /** The operator's detecting lint (DETECTING_LINT), run on the corrupted state, names the target with a finding the clean state lacks. */
  lint_detected: boolean;
  /** The lint ids of every finding on the target the clean state lacks, sorted. */
  new_lint_ids: string[];
  /** verifyChain's verdict on the corrupted log, before any read. */
  verify: Verdict;
  /** The first failing check's name, when the verdict is FAILED. */
  verify_check: string | null;
}

/** One base: its control and its six pairs. */
export interface BaseOutcome {
  question_id: string;
  /** Turns B5 wrote. */
  turns: number;
  /** Items B5's read returned, before the governed supersession. */
  b5_read: number;
  /** Items the clean read returned. */
  clean_read: number;
  /** The clean state's own deterministic findings, by lint id. */
  clean_findings: Record<string, number>;
  /** A copy of the clean log, unedited, through the same steps as a log fault: its verdict and whether both its reads equal the clean read. */
  control: { verify: Verdict; reads_equal_clean: boolean };
  pairs: PairOutcome[];
}

/** mulberry32 over a 32-bit seed from sha256 of `key`. */
export function stream(key: string): () => number {
  let a = createHash("sha256").update(key).digest().readUInt32BE(0);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(items: readonly T[], rand: () => number): T | undefined =>
  items.length === 0 ? undefined : items[Math.floor(rand() * items.length)];

/** Ids for one base: UUIDv7-shaped, sequential. */
function sequentialIds(): () => string {
  let n = 0;
  return () => `01970000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
}

/** The chain's salts, drawn from the config's seed and the question id: 32 bytes each. */
function seededKeeper(seed: number, questionId: string) {
  let n = 0;
  return {
    salt: () =>
      new Uint8Array(createHash("sha256").update(`${seed}:${questionId}:salt:${++n}`).digest()),
  };
}

/** The policy every base is written and read under: preset medium, as B5's C5. */
export const checkPolicy = (): Policy => loadPreset(PRESET);

/** A plane over `db` that reads as C5 reads: the core pipeline at the shared limit. */
function c5Plane(db: Db, policy: Policy, newId: () => string): Plane {
  return createPlane({
    db,
    adapter: createFakeAdapter(),
    policy,
    newId,
    retrieval: { pipeline: "core", limit: READ_LIMIT },
  });
}

/** Every user table of `from`, row for row, into a fresh migrated log. */
function copyLog(from: Db): Db {
  const to = openSqlite(":memory:");
  migrate(to);
  const tables = from
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'schema_migrations' ORDER BY name",
    )
    .all()
    .map((r) => String(r.name));
  to.transaction(() => {
    for (const table of tables) {
      to.exec(`DELETE FROM ${table}`);
      const rows = from.prepare(`SELECT * FROM ${table}`).all();
      for (const row of rows) {
        const cols = Object.keys(row);
        to.prepare(
          `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
        ).run(...cols.map((c) => row[c] as never));
      }
    }
  });
  return to;
}

const ids = (items: readonly MemoryItem[]) => items.map((i) => i.id);
const same = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);
const findingKey = (f: Pick<LintFinding, "lint_id" | "item_id" | "evidence">) =>
  JSON.stringify([f.lint_id, f.item_id, f.evidence]);

/** The writer of an item's next version: the user, with the source its provenance kind implies. */
const writerOf = (item: MemoryItem): Actor => ({
  id: USER,
  level: "person",
  memberships: [USER],
  source: item.provenance.kind === "user" ? "user" : "model",
});

function eventRows(db: Db): { seq: number; event: MemoryEvent }[] {
  return db
    .prepare("SELECT seq, body FROM events ORDER BY seq")
    .all()
    .map((r) => ({ seq: Number(r.seq), event: JSON.parse(String(r.body)) as MemoryEvent }));
}

/** The last allowed event that carries `itemId`'s item: the one the projection holds it from. */
function carrying(db: Db, itemId: string): { seq: number; event: MemoryEvent } {
  const found = eventRows(db)
    .filter((r) => r.event.item_id === itemId && r.event.decision === "allow" && r.event.item)
    .at(-1);
  if (!found) throw new Error(`no allowed event carries item ${itemId}`);
  return found;
}

function writeEventBody(db: Db, seq: number, event: MemoryEvent): void {
  db.prepare("UPDATE events SET decision = ?, body = ? WHERE seq = ?").run(
    event.decision,
    JSON.stringify(event),
    seq,
  );
}

function writeItemBody(db: Db, item: MemoryItem): void {
  db.prepare("UPDATE items SET status = ?, body = ? WHERE id = ?").run(
    item.status,
    JSON.stringify(item),
    item.id,
  );
}

const projected = (db: Db, id: string): MemoryItem => {
  const row = db.prepare("SELECT body FROM items WHERE id = ?").get(id);
  if (!row) throw new Error(`item ${id} is not projected`);
  return JSON.parse(String(row.body)) as MemoryItem;
};

const withoutRef = (item: MemoryItem): MemoryItem => ({
  ...item,
  provenance: { ...item.provenance, ref: "" },
});

/**
 * Applies one fault to `db`, a copy of the clean log. `earlier` is the
 * supersession target as B5's read returned it, before its close.
 */
function inject(
  db: Db,
  operator: Operator,
  place: Place,
  target: string,
  earlier: MemoryItem | undefined,
): void {
  if (place === "projection") {
    if (operator === "deletion") db.prepare("DELETE FROM items WHERE id = ?").run(target);
    else if (operator === "temporal-supersession") writeItemBody(db, earlier as MemoryItem);
    else writeItemBody(db, withoutRef(projected(db, target)));
    return;
  }
  const { seq, event } = carrying(db, target);
  const item = event.item as MemoryItem;
  if (operator === "deletion") writeEventBody(db, seq, { ...event, decision: "deny" });
  else if (operator === "temporal-supersession")
    writeEventBody(db, seq, { ...event, item: { ...item, valid_to: null } });
  else writeEventBody(db, seq, { ...event, item: withoutRef(item) });
}

/** Builds one base's clean state and runs its control and its six pairs. */
export async function checkBase(view: VisibleQuestion, opts: CheckOptions): Promise<BaseOutcome> {
  const policy = checkPolicy();
  const newId = sequentialIds();
  const keeper = seededKeeper(opts.seed, view.question_id);
  const rand = stream(`${opts.seed}:${view.question_id}`);
  const at = readTime(view);
  const reader = userActor();
  const query = { text: view.question, at };

  const db = openSqlite(":memory:");
  migrate(db);
  keepChain(db, keeper);
  const plane = c5Plane(db, policy, newId);
  const writes = await writePhase(plane, view, newId);
  const b5 = (await plane.read(reader, query)).items;

  // The governed supersession: one item of B5's read closed at the read time.
  const earlier = pick(b5, rand);
  if (earlier) {
    const closed = { ...earlier, valid_to: at, version: earlier.version + 1, store_ref: null };
    const w = await plane.write(writerOf(earlier), closed as MemoryItem, at);
    if (w.event.decision !== "allow")
      throw new Error(`${view.question_id}: the governed close was refused: ${w.event.reason}`);
  }
  const clean = ids((await plane.read(reader, query)).items);
  const targets: Record<Operator, string | undefined> = {
    "temporal-supersession": earlier?.id,
    deletion: pick(clean, rand),
    "missing-metadata": pick(clean, rand),
  };

  /** One copy of the clean log through a pair's steps; `fault` edits it first. */
  const run = async (fault?: { operator: Operator; place: Place; target: string }) => {
    const copy = copyLog(db);
    try {
      keepChain(copy, keeper);
      const p = c5Plane(copy, policy, newId);
      if (fault) inject(copy, fault.operator, fault.place, fault.target, earlier);
      const report = verifyChain(copy);
      if (fault?.place !== "projection") rebuild(copy);
      const corrupted = ids((await p.read(reader, query)).items);
      const lint = await p.lint(reader, at, USER);
      if (fault?.place === "projection") rebuild(copy);
      const enforced = ids((await p.read(reader, query)).items);
      return { report, corrupted, enforced, findings: lint.findings };
    } finally {
      copy.close();
    }
  };

  const control = await run();
  const cleanKeys = new Set(control.findings.map(findingKey));
  const cleanFindings: Record<string, number> = {};
  for (const f of control.findings) cleanFindings[f.lint_id] = (cleanFindings[f.lint_id] ?? 0) + 1;

  const pairs: PairOutcome[] = [];
  for (const operator of OPERATORS) {
    for (const place of PLACES) {
      const target = targets[operator];
      if (target === undefined) {
        pairs.push({
          operator,
          place,
          targeted: false,
          target: null,
          changed: false,
          enforced_equals_clean: true,
          lint_detected: false,
          new_lint_ids: [],
          verify: control.report.verdict,
          verify_check: null,
        });
        continue;
      }
      const r = await run({ operator, place, target });
      const fresh = r.findings.filter((f) => f.item_id === target && !cleanKeys.has(findingKey(f)));
      pairs.push({
        operator,
        place,
        targeted: true,
        target,
        changed: !same(r.corrupted, clean),
        enforced_equals_clean: same(r.enforced, clean),
        lint_detected: fresh.some((f) => f.lint_id === DETECTING_LINT[operator]),
        new_lint_ids: [...new Set(fresh.map((f) => f.lint_id))].sort(),
        verify: r.report.verdict,
        verify_check: r.report.verdict === "FAILED" ? (r.report.first_break?.check ?? null) : null,
      });
    }
  }
  db.close();
  return {
    question_id: view.question_id,
    turns: writes.length,
    b5_read: b5.length,
    clean_read: clean.length,
    clean_findings: Object.fromEntries(Object.entries(cleanFindings).sort()),
    control: {
      verify: control.report.verdict,
      reads_equal_clean: same(control.corrupted, clean) && same(control.enforced, clean),
    },
    pairs,
  };
}

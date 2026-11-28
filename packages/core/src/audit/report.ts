// The signed audit report (card E9.15): a content-free statement of a window
// of the event log, as an in-toto Statement in a DSSE envelope (./dsse.ts),
// that an auditor keeps and `verifyAuditReport` checks against the log.
//
// What it states, and nothing more (AGENTS.md rule 12, so a report of a
// dogfood log can be sent): the log's id and its chain head (entries, hash,
// last chained seq), the latest stored checkpoint and whether it is signed,
// the policy's sha256 (the dogfood report's, src/dogfood.ts), the schema
// version, the window, the count of its chained events by decision, by
// operation and by rule (a rule id outside the dogfood report's fixed list,
// `printableRules`, is counted as `other`, since a policy of another name
// could carry anything in its id), and the invariants' oracle's violations
// among them. Never content, an item id, an actor, a scope, a grant, a
// reason or a lineage id: every field visible.ts narrows for a viewer is
// absent by construction, so no viewer is shown one.
//
// Reach (RD1, src/visible.ts: an answer never shows a viewer what they may
// not read). Built for a viewer, the statement counts only the events
// `eventVisibleTo` shows that viewer, names the viewer by its shape only (its
// level and its memberships per level, as the dogfood report declares an
// actor), and leaves out the oracle, which judges every event of the log.
// Built with no viewer, it is the operator's statement of the whole log: the
// operator holds the database, whose every row `engram log verify` already
// counts.
//
// Determinism: the statement is a function of the log to its head, the
// policy, the window, the viewer and the time it is issued at, which is
// injected (core reads no clock); its canonical JSON is the payload, so the
// bytes of a report are fixed by the log, the clock and the key (Ed25519
// signatures are deterministic). The window is half-open on the events'
// own times, `from <= ts < to`, compared by core's one helper (time.ts).
//
// The Statement's layout is ported from in-toto's Attestation Framework
// (https://github.com/in-toto/attestation, commit 50bf01716982,
// spec/v1/statement.md, Apache License, Version 2.0): `_type`, a `subject`
// list of a name and a digest set, a `predicateType` URI and a `predicate`.
// The subject is the log, and its digest the chain head's SHA-256 link.
import type { Actor } from "../actor.ts";
import type { Db } from "../db/db.ts";
import { dogfoodReport, parseEventRows, printableRules } from "../dogfood.ts";
import { type ChainHead, chainCanonical, readGenesis, readHead } from "../log/chain.ts";
import {
  type CheckpointSigner,
  type SignatureCheck,
  type Verdict,
  verifyChain,
} from "../log/verify.ts";
import { type MemoryEvent, type Policy, SCHEMA_VERSION, Timestamp } from "../schema.ts";
import { compareTimestamps } from "../time.ts";
import { eventVisibleTo } from "../visible.ts";
import {
  type Envelope,
  envelopeSignedBy,
  IN_TOTO_PAYLOAD_TYPE,
  parseEnvelope,
  payloadBytes,
  signEnvelope,
} from "./dsse.ts";

export const AUDIT_FORMAT = "engram-audit-report/1";
export const STATEMENT_TYPE = "https://in-toto.io/Statement/v1";
export const AUDIT_PREDICATE_TYPE = "urn:engram:audit-report:v1";

/** The checkpoint a report names: the latest stored one at export. */
export interface AuditCheckpoint {
  n: number;
  size: number;
  /** RFC 6962 root and chain head at its size, hex. */
  root: string;
  head: string;
  at: string;
  /** Whether it carries a signature (the export verified every stored signature under the signer's key). */
  signed: boolean;
  /** The public key it is signed under (base64 SPKI), or null. */
  key: string | null;
}

/** What the reader was: the operator's whole log, or a viewer by its shape. */
export type AuditReach =
  | { whole_log: true }
  | { whole_log: false; level: string; memberships_by_level: Record<string, number> };

export interface AuditPredicate {
  format: typeof AUDIT_FORMAT;
  /** The time the statement was issued at, injected. */
  issued_at: string;
  /** Half-open on the events' times: from <= ts < to. */
  window: { from: string; to: string };
  log: {
    id: string;
    head: ChainHead;
    checkpoint: AuditCheckpoint | null;
    /** A signed checkpoint at exactly the head: every counted event is under a signature. */
    head_signed: boolean;
  };
  policy_sha256: string;
  schema_version: number;
  reach: AuditReach;
  events: {
    /** Chained events in the window (within reach). */
    counted: number;
    first_seq: number | null;
    last_seq: number | null;
    /** Events in the window appended before the chain began: nothing vouches for them, so none is counted. */
    unchained: number;
  };
  by_decision: Record<string, number>;
  by_op: Record<string, Record<string, number>>;
  by_rule: Record<string, Record<string, number>>;
  /**
   * The invariants' oracle over the counted events, judged on the whole log's
   * history, with how many actors were declared to it (no names); null for a viewer.
   */
  oracle: {
    declared: number;
    violations: { read: number; grant_change: number; total: number };
  } | null;
  notes: string[];
}

export interface AuditStatement {
  _type: typeof STATEMENT_TYPE;
  subject: { name: string; digest: { sha256: string } }[];
  predicateType: typeof AUDIT_PREDICATE_TYPE;
  predicate: AuditPredicate;
}

/** What the pure builder is given. */
export interface AuditInput {
  /** The log's events to its head, in seq order: the window's and the history the oracle replays. */
  events: readonly MemoryEvent[];
  /** The first chained seq (the genesis's start). */
  start: number;
  log: string;
  head: ChainHead;
  checkpoint: AuditCheckpoint | null;
  policy: Policy;
  from: string;
  to: string;
  /** The issuing time, injected. */
  at: string;
  /** The reader the counts are for; absent for the operator's whole log. */
  viewer?: Actor;
  /** The actors the oracle judges readers as (the dogfood report's declared actors); any other as --as alone builds it. */
  declared?: readonly Actor[];
}

const NOTES = {
  content:
    "content-free by construction: counts, rule ids from a fixed list, hashes and seqs only; no content, item id, actor, scope, grant, reason or lineage id",
  window: "the window is half-open on the events' own times: from <= ts < to",
  oracle:
    "the oracle is the invariants' (src/oracle.ts), replaying the whole log to the head; the log records no memberships, so a reader not declared to it is judged as the CLI builds an actor from --as alone, and a read through a membership it was not declared is counted as a violation",
  viewer:
    "counted for a viewer: only the events that viewer may see; the oracle judges every event, so it is left out",
  unsigned:
    "no signed checkpoint is at the head: sign one (engram log checkpoint --key) before exporting for every counted event to be under a signature",
  limit:
    "the report vouches for the log as the chain holds it; an erasure the chain verifies may still have left content in a store (card E1.5, finding E1.5-1)",
} as const;

const bump = (m: Record<string, number>, k: string) => {
  m[k] = (m[k] ?? 0) + 1;
};

/** The shape of a viewer, without names (the dogfood report's `declared`). */
function shapeOf(viewer: Actor): AuditReach {
  const byLevel: Record<string, number> = { org: 0, person: 0, role: 0, team: 0 };
  for (const m of viewer.memberships)
    bump(byLevel, m === "org" ? "org" : (m.split(":")[0] ?? "other"));
  return { whole_log: false, level: viewer.level, memberships_by_level: byLevel };
}

function timestamp(what: string, ts: string): string {
  if (!Timestamp.safeParse(ts).success)
    throw new Error(`audit: ${what} ${ts} is not a UTC timestamp`);
  return ts;
}

/** The seq a dogfood report's detail names, and whether it is a read's. */
const DETAIL = /^(\S+) event (\d+) at /;

/** The statement's predicate: pure, from the input alone. */
export function auditPredicate(input: AuditInput): AuditPredicate {
  const from = timestamp("--from", input.from);
  const to = timestamp("--to", input.to);
  const at = timestamp("the issuing time", input.at);
  if (compareTimestamps(from, to) >= 0)
    throw new Error(`audit: the window is empty: --from ${from} is not before --to ${to}`);
  const { policy, viewer } = input;
  const rules = printableRules(policy);
  const inWindow = (e: MemoryEvent) =>
    e.seq <= input.head.seq &&
    compareTimestamps(e.ts, from) >= 0 &&
    compareTimestamps(e.ts, to) < 0;
  const reached = (e: MemoryEvent) => viewer === undefined || eventVisibleTo(viewer, e, policy);

  const counted = new Set<number>();
  let unchained = 0;
  const byDecision: Record<string, number> = {};
  const byOp: Record<string, Record<string, number>> = {};
  const byRule: Record<string, Record<string, number>> = {};
  for (const e of input.events) {
    if (!inWindow(e) || !reached(e)) continue;
    if (e.seq < input.start) {
      unchained++;
      continue;
    }
    counted.add(e.seq);
    bump(byDecision, e.decision);
    byOp[e.op] ??= {};
    bump(byOp[e.op] as Record<string, number>, e.decision);
    const rule = rules.has(e.policy_id) ? e.policy_id : "other";
    byRule[rule] ??= {};
    bump(byRule[rule] as Record<string, number>, e.decision);
  }
  const seqs = [...counted].sort((a, b) => a - b);

  // The policy's hash and the oracle, from the dogfood report over the whole
  // history to the head, with the actors declared to it.
  const history = input.events.filter((e) => e.seq <= input.head.seq);
  const declared = input.declared ?? [];
  const judged = dogfoodReport(history, policy, declared);
  let oracle: AuditPredicate["oracle"] = null;
  if (viewer === undefined) {
    const v = { read: 0, grant_change: 0, total: 0 };
    for (const d of judged.details) {
      const m = DETAIL.exec(d);
      if (!m || !counted.has(Number(m[2]))) continue;
      if (m[1] === "read") v.read++;
      else v.grant_change++;
      v.total++;
    }
    oracle = { declared: declared.length, violations: v };
  }

  const checkpoint = input.checkpoint;
  const headSigned = checkpoint?.signed === true && checkpoint.size === input.head.size;
  const notes: string[] = [NOTES.content, NOTES.window];
  notes.push(viewer === undefined ? NOTES.oracle : NOTES.viewer);
  if (!headSigned) notes.push(NOTES.unsigned);
  notes.push(NOTES.limit);
  return {
    format: AUDIT_FORMAT,
    issued_at: at,
    window: { from, to },
    log: {
      id: input.log,
      head: { size: input.head.size, hash: input.head.hash, seq: input.head.seq },
      checkpoint,
      head_signed: headSigned,
    },
    policy_sha256: judged.report.policy_sha256,
    schema_version: SCHEMA_VERSION,
    reach: viewer === undefined ? { whole_log: true } : shapeOf(viewer),
    events: {
      counted: seqs.length,
      first_seq: seqs[0] ?? null,
      last_seq: seqs.at(-1) ?? null,
      unchained,
    },
    by_decision: byDecision,
    by_op: byOp,
    by_rule: byRule,
    oracle,
    notes,
  };
}

/** The in-toto Statement of a predicate: the log as its subject, the head's link as its digest. */
export function auditStatementOf(predicate: AuditPredicate): AuditStatement {
  return {
    _type: STATEMENT_TYPE,
    subject: [
      { name: `engram.log/${predicate.log.id}`, digest: { sha256: predicate.log.head.hash } },
    ],
    predicateType: AUDIT_PREDICATE_TYPE,
    predicate,
  };
}

/** The payload: the statement's canonical JSON (the chain's one canonical form), as UTF-8. */
export const statementBytes = (s: AuditStatement): Buffer => Buffer.from(chainCanonical(s), "utf8");

// Reading the log. Every read is of the chain's own tables, after the chain
// verifies, so what is read is what the chain vouches for.

/** The chain head at `size` entries, from the chain's rows; undefined when the chain is shorter. */
function headAt(db: Db, size: number, start: number): ChainHead | undefined {
  if (!Number.isSafeInteger(size) || size < 1) return undefined;
  const row = db.prepare("SELECT hash FROM chain WHERE pos = ?").get(size - 1);
  if (!row) return undefined;
  const last = db
    .prepare("SELECT max(seq) AS s FROM chain WHERE kind = 'event' AND pos < ?")
    .get(size)?.s;
  return {
    size,
    hash: String(row.hash),
    seq: last === null || last === undefined ? start - 1 : Number(last),
  };
}

function checkpointRow(row: Record<string, unknown> | undefined): AuditCheckpoint | null {
  if (!row) return null;
  return {
    n: Number(row.n),
    size: Number(row.size),
    root: String(row.root),
    head: String(row.head),
    at: String(row.at),
    signed: row.signature !== null && row.signature !== undefined,
    key: row.key === null || row.key === undefined ? null : String(row.key),
  };
}

const CHECKPOINT_COLUMNS = "n, size, root, head, at, key, signature";

function eventsTo(db: Db, seq: number): MemoryEvent[] {
  const rows = db.prepare("SELECT seq, body FROM events WHERE seq <= ? ORDER BY seq").all(seq);
  const { events, bad } = parseEventRows(rows.map((r) => ({ seq: r.seq, body: r.body })));
  if (bad.length > 0)
    throw new Error(
      `audit: ${bad.length} event rows to the head are not events this plane writes (first seq ${bad[0]})`,
    );
  return events;
}

export interface AuditExportOptions {
  from: string;
  to: string;
  /** The issuing time, injected (the CLI's clock). */
  at: string;
  policy: Policy;
  viewer?: Actor;
  declared?: readonly Actor[];
  /** Checks the stored checkpoints' signatures, under `pin`. */
  verify?: SignatureCheck;
  pin?: string;
}

/**
 * The statement of the window of `db` at its current head. Refuses (throws)
 * unless the chain verifies under `options.verify` and `options.pin` first:
 * a report is never issued over a log that fails.
 */
export function auditStatement(db: Db, options: AuditExportOptions): AuditStatement {
  const chain = verifyChain(db, {
    ...(options.verify === undefined ? {} : { verify: options.verify }),
    ...(options.pin === undefined ? {} : { pin: options.pin }),
  });
  const genesis = readGenesis(db);
  const head = readHead(db);
  if (chain.first_break !== null || !genesis || !head)
    throw new Error(
      `audit export: the log does not verify (${chain.first_break?.check}: ${chain.first_break?.detail}); no report is written`,
    );
  const checkpoint = checkpointRow(
    db.prepare(`SELECT ${CHECKPOINT_COLUMNS} FROM chain_checkpoints ORDER BY n DESC LIMIT 1`).get(),
  );
  return auditStatementOf(
    auditPredicate({
      events: eventsTo(db, head.seq),
      start: genesis.start,
      log: genesis.log,
      head,
      checkpoint,
      policy: options.policy,
      from: options.from,
      to: options.to,
      at: options.at,
      ...(options.viewer === undefined ? {} : { viewer: options.viewer }),
      ...(options.declared === undefined ? {} : { declared: options.declared }),
    }),
  );
}

/** The statement signed into a DSSE envelope by the operator's injected signer. */
export function signAuditStatement(statement: AuditStatement, signer: CheckpointSigner): Envelope {
  return signEnvelope(IN_TOTO_PAYLOAD_TYPE, statementBytes(statement), signer);
}

// Verifying a report against the log.

export interface AuditCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface AuditVerification {
  /** OK: every check holds under the pinned key; FAILED: one failed; UNSIGNED: no key pinned or no check given. */
  verdict: Verdict;
  checks: AuditCheck[];
  /** The statement the envelope carries, once it parses; null before. */
  statement: AuditStatement | null;
  notes: string[];
}

export interface AuditVerifyOptions {
  policy: Policy;
  viewer?: Actor;
  declared?: readonly Actor[];
  verify?: SignatureCheck;
  /** The operator's public key (base64 SPKI), pinned. */
  pin?: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The statement in `bytes`, or why it is not one this plane issues. */
function parseStatement(bytes: Buffer): AuditStatement | string {
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    return "the payload is not JSON";
  }
  if (!isRecord(value) || value._type !== STATEMENT_TYPE)
    return `the payload is not an in-toto Statement (${STATEMENT_TYPE})`;
  if (value.predicateType !== AUDIT_PREDICATE_TYPE)
    return `the statement's predicateType is not ${AUDIT_PREDICATE_TYPE}`;
  const p = value.predicate;
  if (
    !isRecord(p) ||
    p.format !== AUDIT_FORMAT ||
    !isRecord(p.log) ||
    !isRecord(p.log.head) ||
    !isRecord(p.window) ||
    typeof p.issued_at !== "string" ||
    typeof p.window.from !== "string" ||
    typeof p.window.to !== "string" ||
    typeof p.log.id !== "string"
  )
    return `the predicate is not an ${AUDIT_FORMAT}`;
  let canonical: string;
  try {
    canonical = chainCanonical(value);
  } catch {
    return "the payload has no canonical form";
  }
  if (canonical !== bytes.toString("utf8"))
    return "the payload is not in the canonical form the plane issues";
  return value as unknown as AuditStatement;
}

/** The top-level predicate fields where two statements differ, sorted. */
function differences(a: AuditStatement, b: AuditStatement): string[] {
  const out: string[] = [];
  if (chainCanonical(a.subject) !== chainCanonical(b.subject)) out.push("subject");
  const pa = a.predicate as unknown as Record<string, unknown>;
  const pb = b.predicate as unknown as Record<string, unknown>;
  for (const k of [...new Set([...Object.keys(pa), ...Object.keys(pb)])].sort())
    if (chainCanonical(pa[k] ?? null) !== chainCanonical(pb[k] ?? null)) out.push(k);
  return out;
}

/**
 * Checks a report against the log, in order, stopping at the first failure:
 * envelope (a DSSE envelope of an in-toto Statement), signature (over PAE,
 * under the pinned key), statement (an audit report in the plane's canonical
 * form), chain (the log verifies under the pinned key, and is the report's
 * log), head (the report's head is in the chain: an edited, cut or rewritten
 * log fails here or at chain), checkpoint (the checkpoint it names is the one
 * stored), counts (the statement recomputed from the log at that head, the
 * policy and the viewer given, is the one signed). The log may have grown
 * since: only the events to the report's head are read.
 */
export function verifyAuditReport(
  db: Db,
  envelope: unknown,
  options: AuditVerifyOptions,
): AuditVerification {
  const checks: AuditCheck[] = [];
  const notes: string[] = [];
  const out: AuditVerification = { verdict: "FAILED", checks, statement: null, notes };
  const fail = (name: string, detail: string) => {
    checks.push({ name, ok: false, detail });
    return out;
  };
  const pass = (name: string) => checks.push({ name, ok: true });

  const e = parseEnvelope(envelope);
  if (typeof e === "string") return fail("envelope", e);
  if (e.payloadType !== IN_TOTO_PAYLOAD_TYPE)
    return fail("envelope", `the payloadType is ${e.payloadType}, not ${IN_TOTO_PAYLOAD_TYPE}`);
  pass("envelope");

  const pinned = options.pin !== undefined && options.verify !== undefined;
  if (pinned) {
    if (!envelopeSignedBy(e, options.pin as string, options.verify as SignatureCheck))
      return fail(
        "signature",
        "no signature of the envelope verifies under the pinned key: the statement was changed, or signed by another key",
      );
    pass("signature");
  } else
    notes.push(
      "no public key is pinned (--key) or no signature check given, so the signature is not checked and the verdict is UNSIGNED",
    );

  const s = parseStatement(payloadBytes(e));
  if (typeof s === "string") return fail("statement", s);
  out.statement = s;
  pass("statement");
  const p = s.predicate;

  const chain = verifyChain(db, {
    ...(options.verify === undefined ? {} : { verify: options.verify }),
    ...(options.pin === undefined ? {} : { pin: options.pin }),
  });
  const genesis = readGenesis(db);
  if (chain.first_break !== null || !genesis)
    return fail(
      "chain",
      `the log does not verify: ${chain.first_break?.check}: ${chain.first_break?.detail}`,
    );
  if (genesis.log !== p.log.id)
    return fail("chain", `the report is of log ${p.log.id}, not this log (${genesis.log})`);
  pass("chain");

  const stated = p.log.head;
  const head = headAt(db, Number(stated.size), genesis.start);
  if (!head)
    return fail(
      "head",
      `the report's head at ${String(stated.size)} entries is beyond the chain: its tail was cut`,
    );
  if (head.hash !== stated.hash || head.seq !== stated.seq)
    return fail(
      "head",
      `the chain at ${head.size} entries is not the report's head: the log was rewritten`,
    );
  pass("head");

  const c = p.log.checkpoint;
  let checkpoint: AuditCheckpoint | null = null;
  if (c !== null) {
    checkpoint = checkpointRow(
      db.prepare(`SELECT ${CHECKPOINT_COLUMNS} FROM chain_checkpoints WHERE n = ?`).get(c.n),
    );
    if (checkpoint === null || chainCanonical(checkpoint) !== chainCanonical(c))
      return fail(
        "checkpoint",
        `checkpoint ${String(c.n)} as the report names it is not the one the log stores`,
      );
  }
  pass("checkpoint");

  let recomputed: AuditStatement;
  try {
    recomputed = auditStatementOf(
      auditPredicate({
        events: eventsTo(db, head.seq),
        start: genesis.start,
        log: genesis.log,
        head,
        checkpoint,
        policy: options.policy,
        from: p.window.from,
        to: p.window.to,
        at: p.issued_at,
        ...(options.viewer === undefined ? {} : { viewer: options.viewer }),
        ...(options.declared === undefined ? {} : { declared: options.declared }),
      }),
    );
  } catch (err) {
    return fail("counts", (err as Error).message);
  }
  const differ = differences(recomputed, s);
  if (differ.length > 0)
    return fail(
      "counts",
      `the statement recomputed from the log differs in ${differ.join(", ")}: the log was edited, or another policy or viewer is given`,
    );
  pass("counts");

  out.verdict = pinned ? "OK" : "UNSIGNED";
  if (!p.log.head_signed)
    notes.push(
      "no signed checkpoint was at the report's head when it was issued; the chain verified here vouches for it",
    );
  return out;
}

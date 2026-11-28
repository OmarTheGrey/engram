// `engram audit export` and `engram audit verify` (card E9.15): the signed
// audit report of a window of the event log, and its check against the log.
// The statement and its verification are core's (packages/core/src/audit/);
// here are the files, the operator's Ed25519 key (signing.ts, as for `log
// checkpoint`) and the printing. Like `engram log`, both read the log's own
// tables on this machine and never ask a server (a verifier trusts no one's
// answer about the log it checks).
//
// What a report holds is fixed by core: counts by decision, operation and
// rule, the chain head and checkpoint, the policy's hash, the schema version
// and the oracle's count; never content, an id, an actor, a scope or a
// reason (AGENTS.md rule 12). With --as, it counts only the events that
// actor may see (RD1) and names the actor by its shape only.
//
// Exit codes: export 0 written, 1 the log does not verify or an error;
// verify 0 OK, 1 FAILED, 3 UNSIGNED (no --key), as `log verify`; 2 is usage.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type Actor,
  ActorShape,
  type AuditStatement,
  type AuditVerification,
  auditStatement,
  type Checkpoint,
  envelopeText,
  signAuditStatement,
  VERDICT_EXIT,
  verifyAuditReport,
} from "@engram/core";
import { parse } from "./commands.ts";
import { OPTIONS } from "./registry.ts";
import type { Io } from "./run.ts";
import {
  buildActor,
  checkTime,
  dbTarget,
  inspectLog,
  loadPolicy,
  logRefusal,
  openDb,
  UsageError,
} from "./setup.ts";
import { checkpointSigner, publicKeyText, signatureCheck } from "./signing.ts";

const readText = (io: Io, flag: string, path: string) => {
  try {
    return readFileSync(resolve(io.cwd, path), "utf8");
  } catch {
    throw new UsageError(`${flag} ${path} is not a readable file`);
  }
};

type Values = Record<string, string | boolean | string[] | undefined>;

/** The viewer --as names, or none (the operator's whole log). */
function viewerOf(values: Values): Actor | undefined {
  if (values.as === undefined) {
    if (values.level !== undefined || values.member !== undefined)
      throw new UsageError("--level and --member describe the viewer: give --as with them");
    return undefined;
  }
  return buildActor(
    {
      as: values.as as string,
      ...(values.level === undefined ? {} : { level: values.level as string }),
      ...(values.member === undefined ? {} : { member: values.member as string[] }),
    },
    undefined,
  );
}

/**
 * The actors declared to the oracle (--declare <file>): a JSON array of
 * actors as core takes them, each an id, a level and its memberships. The
 * log records no memberships, so without them the report gives no oracle count.
 */
function declaredOf(io: Io, values: Values): Actor[] | undefined {
  if (values.declare === undefined) return undefined;
  const path = values.declare as string;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readText(io, "--declare", path));
  } catch (e) {
    if (e instanceof UsageError) throw e;
    throw new UsageError(`--declare ${path} is not JSON`);
  }
  if (!Array.isArray(parsed) || parsed.length === 0)
    throw new UsageError(`--declare ${path} is not a non-empty JSON array of actors`);
  return parsed.map((a, i) => {
    const r = ActorShape.safeParse(a);
    if (!r.success)
      throw new UsageError(
        `--declare ${path}: actor ${i + 1} is not an actor (id, level, memberships)`,
      );
    return { id: r.data.id, level: r.data.level, memberships: r.data.memberships };
  });
}

/** A checkpoint kept outside the log (log checkpoint --out), as `log verify --checkpoint` reads it. */
function heldCheckpoint(io: Io, path: string): Checkpoint {
  const text = readText(io, "--checkpoint", path);
  try {
    const c = JSON.parse(text) as Checkpoint;
    if (typeof c.note !== "string") throw new Error("no note");
    return { note: c.note, key: c.key ?? null, signature: c.signature ?? null };
  } catch {
    throw new UsageError(
      `--checkpoint ${path} is not a checkpoint engram log checkpoint --out wrote`,
    );
  }
}

/** The log, checked as `log verify` checks it before reading: it must exist and be one this plane can read. */
function openExisting(values: Values, io: Io) {
  const target = dbTarget(values.db as string | undefined, io);
  const state = inspectLog(target);
  if (state.state === "absent") throw new Error(`no event log at ${target.label}`);
  const refusal = logRefusal(target, state);
  if (refusal !== undefined) throw new Error(refusal);
  return openDb(target);
}

/** The statement's summary, as both commands print it. */
function summary(s: AuditStatement): string[] {
  const p = s.predicate;
  const counts = (m: Record<string, number>) =>
    Object.keys(m)
      .sort()
      .map((k) => `${k} ${m[k]}`)
      .join(", ") || "none";
  const lines = [
    `window ${p.window.from} to ${p.window.to} (from <= ts < to), issued ${p.issued_at}`,
    `log ${p.log.id}: head ${p.log.head.hash} at ${p.log.head.size} entries, seq ${p.log.head.seq}`,
    p.log.checkpoint === null
      ? "checkpoint: none"
      : `checkpoint ${p.log.checkpoint.n} at ${p.log.checkpoint.size} entries, ${p.log.checkpoint.signed ? "signed" : "unsigned"}${p.log.head_signed ? ", at the head" : ""}`,
    `policy sha256 ${p.policy_sha256}, schema version ${p.schema_version}`,
    p.reach.whole_log
      ? "reach: the whole log"
      : `reach: a ${p.reach.level} viewer, ${counts(p.reach.memberships_by_level)} memberships by level`,
    `events counted ${p.events.counted}${p.events.unchained > 0 ? `, ${p.events.unchained} unchained left out` : ""}: ${counts(p.by_decision)}`,
  ];
  for (const op of Object.keys(p.by_op).sort())
    lines.push(`  ${op}: ${counts(p.by_op[op] as Record<string, number>)}`);
  for (const rule of Object.keys(p.by_rule).sort())
    lines.push(`  rule ${rule}: ${counts(p.by_rule[rule] as Record<string, number>)}`);
  lines.push(
    p.oracle === null
      ? p.reach.whole_log
        ? "oracle: not counted, no actor declared (--declare)"
        : "oracle: not judged for a viewer"
      : `oracle: ${p.oracle.violations.total} violations (read ${p.oracle.violations.read}, grant change ${p.oracle.violations.grant_change}), ${p.oracle.declared} actors declared, set sha256 ${p.oracle.declared_sha256}`,
  );
  for (const n of p.notes) lines.push(`note: ${n}`);
  return lines;
}

async function exportCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(args, OPTIONS["audit export"], false);
  const from = checkTime("--from", values.from);
  const to = checkTime("--to", values.to);
  if (from === undefined || to === undefined) throw new UsageError("give --from and --to");
  if (values.key === undefined)
    throw new UsageError("give --key <private.pem>: a report is signed with the operator's key");
  let signer: ReturnType<typeof checkpointSigner>;
  try {
    signer = checkpointSigner(readText(io, "--key", values.key));
  } catch (e) {
    if (e instanceof UsageError) throw e;
    throw new UsageError(
      `--key ${values.key} is not an Ed25519 private key in PEM: ${(e as Error).message}`,
    );
  }
  const policy = loadPolicy(values.policy, io.cwd);
  const viewer = viewerOf(values);
  const declared = declaredOf(io, values);
  const db = openExisting(values, io);
  try {
    // Nothing is signed unless the log verifies first, every stored
    // checkpoint under the signer's own key (as log checkpoint signs).
    const statement = auditStatement(db, {
      from,
      to,
      at: io.now(),
      policy,
      verify: signatureCheck,
      pin: signer.key,
      ...(viewer === undefined ? {} : { viewer }),
      ...(declared === undefined ? {} : { declared }),
    });
    const text = envelopeText(signAuditStatement(statement, signer));
    if (values.out === undefined) {
      io.out(text);
      return 0;
    }
    writeFileSync(resolve(io.cwd, values.out), text);
    io.out(
      `${[`engram audit export: written to ${values.out}, signed`, ...summary(statement)].join("\n")}\n`,
    );
    return 0;
  } finally {
    db.close();
  }
}

function report(v: AuditVerification): string {
  const lines = [`engram audit verify: ${v.verdict}`];
  for (const c of v.checks)
    lines.push(`  ${c.ok ? "ok  " : "fail"}  ${c.name}${c.ok ? "" : `: ${c.detail}`}`);
  if (v.statement !== null) lines.push(...summary(v.statement));
  for (const n of v.notes) lines.push(`note: ${n}`);
  return `${lines.join("\n")}\n`;
}

async function verifyCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(args, OPTIONS["audit verify"], false);
  if (values.report === undefined) throw new UsageError("give --report <file>");
  let envelope: unknown;
  const text = readText(io, "--report", values.report);
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new UsageError(`--report ${values.report} is not JSON`);
  }
  let pin: string | undefined;
  if (values.key !== undefined) {
    try {
      pin = publicKeyText(readText(io, "--key", values.key));
    } catch (e) {
      if (e instanceof UsageError) throw e;
      throw new UsageError(
        `--key ${values.key} is not an Ed25519 PEM key: ${(e as Error).message}`,
      );
    }
  }
  const policy = loadPolicy(values.policy, io.cwd);
  const viewer = viewerOf(values);
  const declared = declaredOf(io, values);
  const held = ((values.checkpoint as string[] | undefined) ?? []).map((c) =>
    heldCheckpoint(io, c),
  );
  const db = openExisting(values, io);
  try {
    const v = verifyAuditReport(db, envelope, {
      policy,
      verify: signatureCheck,
      ...(pin === undefined ? {} : { pin }),
      ...(viewer === undefined ? {} : { viewer }),
      ...(declared === undefined ? {} : { declared }),
      ...(held.length === 0 ? {} : { held }),
    });
    io.out(values.json ? `${JSON.stringify(v, null, 2)}\n` : report(v));
    return VERDICT_EXIT[v.verdict];
  } finally {
    db.close();
  }
}

export async function auditCommand(args: string[], io: Io): Promise<number> {
  const [sub, ...rest] = args;
  if (sub === "export") return exportCommand(rest, io);
  if (sub === "verify") return verifyCommand(rest, io);
  throw new UsageError(`engram audit takes export or verify, not ${JSON.stringify(sub ?? "")}`);
}

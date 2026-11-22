// `engram log verify` and `engram log checkpoint` (card E1.6, ADR 0038): the
// event log's hash chain, read and anchored on this machine. Neither goes
// through the client: the chain is the log's own tables, and a server named
// by --server is not asked (a verifier trusts no one's answer about the log
// it checks). The verdicts and exit codes are core's (log/verify.ts): 0 OK,
// 1 FAILED, 3 UNSIGNED; 2 is bad usage, as for every command.
//
// Key custody is the operator's: --key names a PEM file they hold. A
// checkpoint signed with it proves the holder of the key saw that head, not
// that the log is true; a checkpoint kept outside the log (--out, then
// verify --checkpoint) is what detects a rewrite by someone with database
// access, and pinning the public key (verify --key) is what stops a rewriter
// signing a new history with a key of their own.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type ChainReport,
  type Checkpoint,
  VERDICT_EXIT,
  verifyChain,
  writeCheckpoint,
} from "@engram/core";
import { keepLogChain } from "./chain.ts";
import { parse } from "./commands.ts";
import type { Io } from "./run.ts";
import { dbTarget, inspectLog, logRefusal, openDb, openLog, UsageError } from "./setup.ts";
import { checkpointSigner, publicKeyText, signatureCheck } from "./signing.ts";

const VERIFY_OPTIONS = {
  db: { type: "string" },
  key: { type: "string" },
  checkpoint: { type: "string", multiple: true },
  json: { type: "boolean" },
} as const;

const CHECKPOINT_OPTIONS = {
  db: { type: "string" },
  key: { type: "string" },
  out: { type: "string" },
  json: { type: "boolean" },
} as const;

const readText = (io: Io, flag: string, path: string) => {
  try {
    return readFileSync(resolve(io.cwd, path), "utf8");
  } catch {
    throw new UsageError(`${flag} ${path} is not a readable file`);
  }
};

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

function report(r: ChainReport): string {
  const lines = [`engram log verify: ${r.verdict}`];
  for (const c of r.checks)
    lines.push(`  ${c.ok ? "ok  " : "fail"}  ${c.name}${c.ok ? "" : `: ${c.detail}`}`);
  if (r.first_break)
    lines.push(
      `first broken link: ${r.first_break.check}${r.first_break.pos === null ? "" : `, chain position ${r.first_break.pos}`}${r.first_break.seq === null ? "" : `, event seq ${r.first_break.seq}`}`,
    );
  const c = r.counts;
  lines.push(
    `log ${r.log ?? "(none)"}: ${c.entries} chain entries, ${c.events} events chained, ${c.unchained} unchained, ${c.erased} erased, ${c.manifests} manifests, ${c.checkpoints} checkpoints`,
  );
  if (r.head) lines.push(`head ${r.head.hash} root ${r.head.root} size ${r.head.size}`);
  for (const n of r.notes) lines.push(`note: ${n}`);
  return `${lines.join("\n")}\n`;
}

async function verifyCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(args, VERIFY_OPTIONS, false);
  const target = dbTarget(values.db, io);
  const state = inspectLog(target);
  if (state.state === "absent") throw new Error(`no event log at ${target.label}`);
  const refusal = logRefusal(target, state);
  if (refusal !== undefined) throw new Error(refusal);
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
  const held = (values.checkpoint ?? []).map((p) => heldCheckpoint(io, p));
  // Read only: no migration, no chain begun, nothing written.
  const db = openDb(target);
  try {
    const r = verifyChain(db, {
      verify: signatureCheck,
      held,
      ...(pin === undefined ? {} : { pin }),
    });
    io.out(values.json ? `${JSON.stringify(r, null, 2)}\n` : report(r));
    return VERDICT_EXIT[r.verdict];
  } finally {
    db.close();
  }
}

async function checkpointCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(args, CHECKPOINT_OPTIONS, false);
  const target = dbTarget(values.db, io);
  let signer: ReturnType<typeof checkpointSigner> | undefined;
  if (values.key !== undefined) {
    try {
      signer = checkpointSigner(readText(io, "--key", values.key));
    } catch (e) {
      if (e instanceof UsageError) throw e;
      throw new UsageError(
        `--key ${values.key} is not an Ed25519 private key in PEM: ${(e as Error).message}`,
      );
    }
  }
  const log = openLog(target, true);
  try {
    keepLogChain(log.db);
    const cp = writeCheckpoint(log.db, io.now(), signer);
    const held = { note: cp.note, key: cp.key, signature: cp.signature };
    if (values.out !== undefined)
      writeFileSync(resolve(io.cwd, values.out), `${JSON.stringify(held, null, 2)}\n`);
    if (values.json) io.out(`${JSON.stringify(cp, null, 2)}\n`);
    else
      io.out(
        `engram log checkpoint: checkpoint ${cp.n} of ${target.label} at size ${cp.size}, ${cp.signature ? "signed" : "unsigned (no --key)"}${values.out === undefined ? "" : `, kept in ${values.out}`}\n${cp.note}`,
      );
    return 0;
  } finally {
    log.db.close();
  }
}

export async function logCommand(args: string[], io: Io): Promise<number> {
  const [sub, ...rest] = args;
  if (sub === "verify") return verifyCommand(rest, io);
  if (sub === "checkpoint") return checkpointCommand(rest, io);
  throw new UsageError(`engram log takes verify or checkpoint, not ${JSON.stringify(sub ?? "")}`);
}

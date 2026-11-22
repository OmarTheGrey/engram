// The chain's verifier and its checkpoints (card E1.6, ADR 0038; the writer
// is log/chain.ts). `verifyChain` runs ordered, named checks, each needing
// the one before it to hold, and stops at the first broken link, which it
// names by chain position and seq:
//
//   tables       migration 5's tables are there
//   genesis      position 0 is a genesis that links from CHAIN_SEED
//   links        every later entry, in position order: event entries cover
//                the seqs from the genesis's start without a gap, each event
//                row matches its own body, its record recomputes from the
//                body and its stored commitments, and its hash links to the
//                one before; manifests recompute and name only erase events
//                chained before them
//   anchor       the head row holds the entry count, the last hash and the
//                last chained seq, and no event lies beyond it (a truncated
//                tail, or an event a writer appended outside the chain)
//   commitments  an event with its salt recomputes every commitment from its
//                body; one without verifies as erased only when a chained
//                manifest names it and its redacted parts hold the marker;
//                an event a manifest names keeps no salt
//   checkpoints  each stored checkpoint's root (RFC 6962, log/merkle.ts) and
//                head recompute at its size, and its signature verifies
//   held         each checkpoint the operator kept outside the log does too
//
// The verdict is FAILED when a check fails, UNSIGNED when every check holds
// but the latest checkpoint carries no signature the injected check accepts
// (or there is none), and OK otherwise. Signing and signature checks are
// injected (the CLI holds the Ed25519 key), so core holds no key.
//
// Ported in part from world-model-mcp (https://github.com/SaravananJaichandar/world-model-mcp,
// commit c46462dbf816f6b5b95b3fd021629d513c4d23e9, world_model_server/etch_verify.py,
// MIT): ordered named checks where each pass needs the previous one, the first
// failure ending the walk, an UNSIGNED verdict of its own with exit code 3,
// key pinning, and the note on what is not covered by a signature. The head
// and count anchor against tail truncation is octopus-blackboard's and
// Compartment's (docs/research/absorb/19-github-scout.md); the checkpoint
// body is C2SP tlog-checkpoint's (origin, size, base64 root, extension lines).
import type { Db, Row } from "../db/db.ts";
import { ERASURE_ID } from "../events.ts";
import { type MemoryEvent, type MemoryItem, Timestamp } from "../schema.ts";
import {
  CHAIN_SEED,
  CHAIN_VERSION,
  chainCanonical,
  chainTables,
  commitments,
  committedParts,
  eventRecord,
  type Genesis,
  leafHash,
  type Manifest,
  nodeHash,
  readHead,
} from "./chain.ts";
import { merkleRoot } from "./merkle.ts";
import { redacted, redactedLintReason } from "./redact.ts";

export type Verdict = "OK" | "FAILED" | "UNSIGNED";

/** The exit code of each verdict (world-model-mcp's): 0 OK, 1 FAILED, 3 UNSIGNED. */
export const VERDICT_EXIT: Readonly<Record<Verdict, number>> = { OK: 0, FAILED: 1, UNSIGNED: 3 };

export interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

/** Where the first broken link is. */
export interface Break {
  check: string;
  pos: number | null;
  seq: number | null;
  detail: string;
}

export interface ChainReport {
  verdict: Verdict;
  checks: Check[];
  /** The first check that failed, with its chain position and event seq; null when none did. */
  first_break: Break | null;
  /** The log's id, from its genesis; null when there is none. */
  log: string | null;
  counts: {
    /** Chain entries, the genesis included. */
    entries: number;
    /** Events chained. */
    events: number;
    /** Events appended before the chain began, which nothing vouches for. */
    unchained: number;
    /** Chained events an offboarding erased (no salt, in a manifest). */
    erased: number;
    manifests: number;
    checkpoints: number;
  };
  /** The head the walk reached: entry count, chain hash and RFC 6962 root. */
  head: { size: number; hash: string; root: string } | null;
  notes: string[];
}

/** Signs a checkpoint's note; injected at the boundary (the CLI's Ed25519 key). */
export interface CheckpointSigner {
  /** The public key the signature verifies under, as text (the CLI: base64 SPKI). */
  key: string;
  /** The signature over `message`, base64. */
  sign(message: Uint8Array): string;
}

/** Checks a signature over `message` under the public key `key`; injected. */
export type SignatureCheck = (message: Uint8Array, signature: string, key: string) => boolean;

/** A checkpoint as it is stored and as the operator keeps it outside the log. */
export interface Checkpoint {
  /** The C2SP tlog-checkpoint body: origin, size, base64 root, then `head` and `time` lines. */
  note: string;
  key: string | null;
  signature: string | null;
}

export interface StoredCheckpoint extends Checkpoint {
  n: number;
  log: string;
  size: number;
  root: string;
  head: string;
  at: string;
}

export interface VerifyOptions {
  /** Checks signatures; without it a signature cannot be checked and the verdict is at best UNSIGNED. */
  verify?: SignatureCheck;
  /** The operator's public key, pinned: a checkpoint signed under any other fails. */
  pin?: string;
  /** Checkpoints the operator kept outside the log; the log must extend each. */
  held?: Checkpoint[];
}

const b64 = (hex: string) => Buffer.from(hex, "hex").toString("base64");
const unb64 = (text: string) => Buffer.from(text, "base64").toString("hex");

/** The C2SP tlog-checkpoint body of a checkpoint. */
export function checkpointNote(log: string, size: number, root: string, head: string, at: string) {
  return `engram.log/${log}\n${size}\n${b64(root)}\nhead ${b64(head)}\ntime ${at}\n`;
}

/** The fields of a checkpoint note, or null when it is not one. */
export function parseNote(
  note: string,
): { log: string; size: number; root: string; head: string; at: string } | null {
  const m =
    /^engram\.log\/([0-9a-f]+)\n(\d+)\n([A-Za-z0-9+/=]+)\nhead ([A-Za-z0-9+/=]+)\ntime (\S+)\n$/.exec(
      note,
    );
  if (!m) return null;
  const [, log, size, root, head, at] = m as unknown as string[];
  return {
    log: log as string,
    size: Number(size),
    root: unb64(root as string),
    head: unb64(head as string),
    at: at as string,
  };
}

const COLUMNS = ["id", "op", "item_id", "actor", "scope_from", "scope_to", "decision"] as const;

interface Walk {
  checks: Check[];
  failure: Break | null;
  genesis: Genesis | null;
  leaves: string[];
  hashes: string[];
  counts: ChainReport["counts"];
}

/** The checks up to `commitments`, which a checkpoint needs to hold before it is written. */
function walk(db: Db): Walk {
  const checks: Check[] = [];
  const counts = { entries: 0, events: 0, unchained: 0, erased: 0, manifests: 0, checkpoints: 0 };
  const out: Walk = { checks, failure: null, genesis: null, leaves: [], hashes: [], counts };
  const fail = (
    check: string,
    detail: string,
    pos: number | null = null,
    seq: number | null = null,
  ) => {
    checks.push({ name: check, ok: false, detail });
    out.failure = { check, pos, seq, detail };
    return out;
  };

  if (!chainTables(db))
    return fail("tables", "the log has no chain tables: migration 5 was never applied");
  checks.push({ name: "tables", ok: true });

  const rows = db.prepare("SELECT pos, kind, seq, data, hash FROM chain ORDER BY pos").all();
  const first = rows[0];
  if (first?.kind !== "genesis")
    return fail(
      "genesis",
      "the chain has no genesis at position 0: it never began, or it was cut",
      0,
    );
  let genesis: Genesis;
  try {
    genesis = JSON.parse(String(first.data)) as Genesis;
  } catch {
    return fail("genesis", "the genesis record is not JSON", 0);
  }
  const genesisText = chainCanonical(genesis);
  if (
    genesisText !== String(first.data) ||
    genesis.kind !== "genesis" ||
    genesis.version !== CHAIN_VERSION ||
    typeof genesis.log !== "string" ||
    !Number.isInteger(genesis.start) ||
    genesis.start < 0
  )
    return fail(
      "genesis",
      `the genesis record is not one this chain writes: ${String(first.data)}`,
      0,
    );
  const genesisLeaf = leafHash(genesisText);
  const genesisHash = nodeHash(CHAIN_SEED, genesisLeaf);
  if (genesisHash !== String(first.hash))
    return fail("genesis", "the genesis's hash does not link from the chain's seed", 0);
  out.genesis = genesis;
  out.leaves.push(genesisLeaf);
  out.hashes.push(genesisHash);
  checks.push({ name: "genesis", ok: true });

  const events = new Map<number, Row>();
  for (const row of db
    .prepare(
      "SELECT seq, id, op, item_id, actor, scope_from, scope_to, decision, body FROM events ORDER BY seq",
    )
    .all())
    events.set(Number(row.seq), row);
  const bodies = new Map<number, MemoryEvent>();
  const given = new Map<number, Record<string, string>>();
  const entryPos = new Map<number, number>();
  /** seq to the position of the manifest that names it. */
  const named = new Map<number, number>();
  let next = genesis.start;
  let prev = genesisHash;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as Row;
    const pos = Number(row.pos);
    if (pos !== i) return fail("links", `position ${i} is missing: the next entry is at ${pos}`, i);
    let record: string;
    if (row.kind === "event") {
      const seq = row.seq === null ? null : Number(row.seq);
      if (seq !== next)
        return fail("links", `the entry chains seq ${seq}, where seq ${next} comes next`, pos, seq);
      const stored = events.get(seq);
      if (!stored)
        return fail("links", `event ${seq} is chained but not in the log: deleted`, pos, seq);
      let body: MemoryEvent;
      try {
        body = JSON.parse(String(stored.body)) as MemoryEvent;
      } catch {
        return fail("links", `event ${seq}'s body is not JSON`, pos, seq);
      }
      if (body.seq !== seq)
        return fail("links", `event ${seq}'s body says seq ${body.seq}: moved`, pos, seq);
      for (const column of COLUMNS)
        if ((stored[column] ?? null) !== (body[column] ?? null))
          return fail(
            "links",
            `event ${seq}'s ${column} column (${String(stored[column])}) differs from its body (${String(body[column])})`,
            pos,
            seq,
          );
      let commits: Record<string, string>;
      try {
        commits = JSON.parse(String(row.data)) as Record<string, string>;
      } catch {
        return fail("links", `event ${seq}'s commitments are not JSON`, pos, seq);
      }
      const expected = [...committedParts(body).keys()].sort().join(",");
      if (Object.keys(commits).sort().join(",") !== expected)
        return fail(
          "links",
          `event ${seq} commits to [${Object.keys(commits).sort().join(", ")}], where its body has [${expected}]`,
          pos,
          seq,
        );
      record = eventRecord(body, commits);
      bodies.set(seq, body);
      given.set(seq, commits);
      entryPos.set(seq, pos);
      counts.events++;
      next++;
    } else if (row.kind === "manifest") {
      let manifest: Manifest;
      try {
        manifest = JSON.parse(String(row.data)) as Manifest;
      } catch {
        return fail("links", "a manifest record is not JSON", pos);
      }
      record = chainCanonical(manifest);
      if (record !== String(row.data) || manifest.kind !== "manifest")
        return fail("links", "a manifest record is not one this chain writes", pos);
      for (const seq of manifest.erase) {
        const erase = bodies.get(seq);
        if (erase?.decision !== "allow" || erase.op !== "retire" || erase.policy_id !== ERASURE_ID)
          return fail(
            "links",
            `the manifest names seq ${seq} as an erase event, which no erase event chained before it is`,
            pos,
            seq,
          );
      }
      for (const seq of manifest.redacted) if (!named.has(seq)) named.set(seq, pos);
      counts.manifests++;
    } else {
      return fail(
        "links",
        `an entry of kind ${String(row.kind)} is not one this chain writes`,
        pos,
      );
    }
    const leaf = leafHash(record);
    const hash = nodeHash(prev, leaf);
    if (hash !== String(row.hash))
      return fail(
        "links",
        "the entry does not recompute: it, or one before it, was changed",
        pos,
        row.seq === null ? null : Number(row.seq),
      );
    out.leaves.push(leaf);
    out.hashes.push(hash);
    prev = hash;
  }
  counts.entries = rows.length;
  checks.push({ name: "links", ok: true });

  const head = readHead(db);
  const lastSeq = next - 1;
  if (!head) return fail("anchor", "the head row (chain_head) is gone");
  if (head.size !== rows.length || head.hash !== prev || head.seq !== lastSeq)
    return fail(
      "anchor",
      `the head row says ${head.size} entries ending in seq ${head.seq}, where the chain holds ${rows.length} ending in seq ${lastSeq}: its tail was cut, or the head was moved`,
    );
  const beyond = [...events.keys()].filter((s) => s > lastSeq).sort((a, b) => a - b);
  if (beyond.length > 0)
    return fail(
      "anchor",
      `event ${beyond[0]} is not chained: appended outside the chain (by a writer that does not keep it) or inserted`,
      null,
      beyond[0] ?? null,
    );
  counts.unchained = [...events.keys()].filter((s) => s < genesis.start).length;
  checks.push({ name: "anchor", ok: true });

  const salts = new Map<number, string>();
  for (const row of db.prepare("SELECT seq, salt FROM chain_salts").all())
    salts.set(Number(row.seq), String(row.salt));
  for (const [seq, body] of bodies) {
    const pos = entryPos.get(seq) ?? null;
    const commits = given.get(seq) ?? {};
    const parts = Object.keys(commits).length;
    const salt = salts.get(seq);
    const manifest = named.get(seq);
    if (manifest !== undefined && manifest > (pos ?? 0)) {
      if (salt !== undefined)
        return fail("commitments", `event ${seq} was erased but its salt was kept`, pos, seq);
      if (!holdsMarker(body))
        return fail(
          "commitments",
          `event ${seq} was erased, but its redacted parts no longer hold the redaction marker: rewritten after the erasure`,
          pos,
          seq,
        );
      if (parts > 0) counts.erased++;
      continue;
    }
    if (parts === 0) {
      if (salt !== undefined)
        return fail("commitments", `event ${seq} commits to nothing, yet has a salt`, pos, seq);
      continue;
    }
    if (salt === undefined)
      return fail(
        "commitments",
        `event ${seq}'s salt is gone and no chained manifest names it: a redaction no offboarding made, or a deleted salt`,
        pos,
        seq,
      );
    const recomputed = commitments(body, Buffer.from(salt, "hex"));
    for (const part of Object.keys(commits))
      if (recomputed[part] !== commits[part])
        return fail(
          "commitments",
          `event ${seq}'s ${part} does not match its commitment: edited`,
          pos,
          seq,
        );
  }
  for (const seq of salts.keys())
    if (!bodies.has(seq))
      return fail(
        "commitments",
        `a salt is stored for seq ${seq}, which the chain does not hold`,
        null,
        seq,
      );
  checks.push({ name: "commitments", ok: true });
  return out;
}

/** Whether an erased event's redacted parts hold the marker: redacting it again changes nothing. */
function holdsMarker(event: MemoryEvent): boolean {
  if (
    event.item &&
    chainCanonical(redacted(event.item as MemoryItem)) !== chainCanonical(event.item)
  )
    return false;
  if (event.op === "lint" && redactedLintReason(event.reason) !== event.reason) return false;
  return true;
}

function storedCheckpoints(db: Db): StoredCheckpoint[] {
  return db
    .prepare(
      "SELECT n, size, root, head, at, note, key, signature FROM chain_checkpoints ORDER BY n",
    )
    .all()
    .map((r) => ({
      n: Number(r.n),
      log: parseNote(String(r.note))?.log ?? "",
      size: Number(r.size),
      root: String(r.root),
      head: String(r.head),
      at: String(r.at),
      note: String(r.note),
      key: r.key === null ? null : String(r.key),
      signature: r.signature === null ? null : String(r.signature),
    }));
}

/**
 * Verifies the log's chain, its anchor, its commitments and its checkpoints,
 * in order, stopping at the first broken link.
 */
export function verifyChain(db: Db, options: VerifyOptions = {}): ChainReport {
  const w = walk(db);
  const notes: string[] = [];
  const report: ChainReport = {
    verdict: "FAILED",
    checks: w.checks,
    first_break: w.failure,
    log: w.genesis?.log ?? null,
    counts: w.counts,
    head:
      w.failure === null
        ? { size: w.leaves.length, hash: w.hashes.at(-1) as string, root: merkleRoot(w.leaves) }
        : null,
    notes,
  };
  const fail = (check: string, detail: string) => {
    w.checks.push({ name: check, ok: false, detail });
    report.first_break = { check, pos: null, seq: null, detail };
    return report;
  };
  if (w.failure !== null || !w.genesis) return report;
  const log = w.genesis.log;

  /** Whether a checkpoint at a size the chain holds recomputes, and whether its signature counts. */
  const judge = (c: Checkpoint, what: string): string | { signed: boolean; size: number } => {
    const f = parseNote(c.note);
    if (!f) return `${what} is not a checkpoint note this log writes`;
    if (f.log !== log) return `${what} is of log ${f.log}, not this log (${log})`;
    if (f.size < 1 || f.size > w.leaves.length)
      return `${what} covers ${f.size} entries, but the chain holds ${w.leaves.length}: its tail was cut`;
    if (merkleRoot(w.leaves.slice(0, f.size)) !== f.root || w.hashes[f.size - 1] !== f.head)
      return `${what} at size ${f.size} does not match the chain at that size: the log was rewritten`;
    if (c.signature === null || c.signature === undefined || c.key === null || c.key === undefined)
      return { signed: false, size: f.size };
    if (options.pin !== undefined && c.key !== options.pin)
      return `${what} is signed by a key other than the pinned one`;
    if (!options.verify) return { signed: false, size: f.size };
    if (!options.verify(Buffer.from(c.note, "utf8"), c.signature, c.key))
      return `${what}'s signature does not verify`;
    return { signed: true, size: f.size };
  };

  const stored = storedCheckpoints(db);
  report.counts.checkpoints = stored.length;
  let latest: { signed: boolean; size: number } | null = null;
  const keep = (j: { signed: boolean; size: number }) => {
    if (!latest || j.size > latest.size || (j.size === latest.size && j.signed)) latest = j;
  };
  for (const c of stored) {
    const f = parseNote(c.note);
    if (!f || f.size !== c.size || f.root !== c.root || f.head !== c.head || f.at !== c.at)
      return fail("checkpoints", `checkpoint ${c.n}'s columns differ from its note`);
    const j = judge(c, `checkpoint ${c.n}`);
    if (typeof j === "string") return fail("checkpoints", j);
    keep(j);
  }
  w.checks.push({ name: "checkpoints", ok: true });
  for (const [i, c] of (options.held ?? []).entries()) {
    const j = judge(c, `the held checkpoint ${i + 1}`);
    if (typeof j === "string") return fail("held", j);
    keep(j);
  }
  if ((options.held ?? []).length > 0) w.checks.push({ name: "held", ok: true });

  const last = latest as { signed: boolean; size: number } | null;
  report.verdict = last?.signed ? "OK" : "UNSIGNED";
  if (!last) notes.push("no checkpoint: nothing signs this log's head, so the verdict is UNSIGNED");
  else if (!last.signed)
    notes.push(
      options.verify
        ? "the latest checkpoint carries no signature, so the verdict is UNSIGNED"
        : "no signature check was given, so no signature counts and the verdict is UNSIGNED",
    );
  if (last && last.size < w.leaves.length)
    notes.push(
      `${w.leaves.length - last.size} chain entries after the latest checkpoint are covered by no checkpoint`,
    );
  if (last?.signed && options.pin === undefined)
    notes.push(
      "signatures were checked against the key each checkpoint names; pin the operator's public key, or a rewriter with database access can sign a new history",
    );
  if (w.counts.unchained > 0)
    notes.push(
      `${w.counts.unchained} events before seq ${w.genesis.start} were appended before the chain began; nothing vouches for them`,
    );
  notes.push(
    "the chain vouches for the log only: an erasure verified here may still have left content in a store (card E1.5, finding E1.5-1), which the deletion report and the dogfood report are where to look",
  );
  return report;
}

/**
 * Writes a checkpoint of the head at time `at`, signed by `signer` when one
 * is given, inside one transaction. Refuses (throws) when the chain does not
 * verify, so no key signs a broken log.
 */
export function writeCheckpoint(db: Db, at: string, signer?: CheckpointSigner): StoredCheckpoint {
  if (!Timestamp.safeParse(at).success) throw new Error(`checkpoint: ${at} is not a UTC timestamp`);
  return db.transaction(() => {
    const w = walk(db);
    if (w.failure !== null || !w.genesis)
      throw new Error(
        `checkpoint: the chain does not verify (${w.failure?.check}: ${w.failure?.detail}); no checkpoint is written`,
      );
    const size = w.leaves.length;
    const root = merkleRoot(w.leaves);
    const head = w.hashes[size - 1] as string;
    const note = checkpointNote(w.genesis.log, size, root, head, at);
    const signature = signer ? signer.sign(Buffer.from(note, "utf8")) : null;
    const key = signer ? signer.key : null;
    const n = Number(
      db.prepare("SELECT coalesce(max(n) + 1, 0) AS n FROM chain_checkpoints").get()?.n ?? 0,
    );
    db.prepare(
      "INSERT INTO chain_checkpoints (n, size, root, head, at, note, key, signature) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(n, size, root, head, at, note, key, signature);
    return { n, log: w.genesis.log, size, root, head, at, note, key, signature };
  });
}

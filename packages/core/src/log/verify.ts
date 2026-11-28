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
//                one before; a manifest recomputes, its erase events are
//                exactly the entries chained just before it and named by no
//                other manifest (E1.6-12), it names an erase event whenever it
//                names a redacted event, and names only item events whose item
//                one of its erase events erased (review fix pass, E1.6-3)
//   anchor       the head row holds the entry count, the last hash and the
//                last chained seq, and no event lies beyond it (a truncated
//                tail, or an event a writer appended outside the chain)
//   commitments  an event with its salt recomputes every commitment from its
//                body; one without verifies as erased only when a manifest
//                chained after it names it and its redacted parts hold the
//                marker; an event a manifest names keeps no salt
//   attestations from chain version 2 (card E1.9), each event chained under
//                it has exactly the attestation row its entry's digest names,
//                or none when its entry names none; a row of an event chained
//                under version 1, or before the chain began, is counted as
//                uncovered, and a row naming no event in the log fails
//   checkpoints  each stored checkpoint's root (RFC 6962, log/merkle.ts) and
//                head recompute at its size, and its signature verifies
//   held         each checkpoint the operator kept outside the log does too
//
// The walk reads both chain versions (log/chain.ts): the genesis's version,
// raised by each version entry to exactly the next one this verifier knows.
//
// A row that is not what this chain writes (a null body, a manifest whose
// lists are not lists of seqs) fails the check that reads it; it never
// throws (E1.6-6).
//
// The verdict (the lead's rule of the review fix pass, E1.6-4): FAILED when a
// check fails; OK only when a signed checkpoint, verified under the pinned
// public key, covers the whole chain; UNSIGNED for anything less: no
// checkpoint, no key pinned, no signature check given, no signature that
// counts, or entries after the latest signed checkpoint. What the design
// cannot detect: without a checkpoint held outside the database, anyone with
// database access can cut the tail or rewrite the whole chain (E1.6-7); the
// verdict is then UNSIGNED, never OK. Signing and signature checks are
// injected (the CLI holds the Ed25519 key), so core holds no key.
//
// Ported in part from world-model-mcp (https://github.com/SaravananJaichandar/world-model-mcp,
// commit c46462dbf816f6b5b95b3fd021629d513c4d23e9, world_model_server/etch_verify.py,
// MIT): ordered named checks where each pass needs the previous one, the first
// failure ending the walk, an UNSIGNED verdict of its own with exit code 3,
// key pinning, and the note on what is not covered by a signature. Its OK
// (at least one epoch signed) is narrowed here as above. The head and count
// anchor is an idea from octopus-blackboard and Compartment, as the research
// reports them (docs/research/absorb/19-github-scout.md); the checkpoint body
// is C2SP tlog-checkpoint's (origin, size, base64 root, extension lines).
import type { Db, Row } from "../db/db.ts";
import { ERASURE_ID } from "../events.ts";
import { type MemoryEvent, type MemoryItem, Timestamp } from "../schema.ts";
import {
  ATTESTATION_KEY,
  attestationDigest,
  CHAIN_SEED,
  CHAIN_VERSION,
  chainCanonical,
  chainLink,
  chainTables,
  commitments,
  committedParts,
  eventRecord,
  type Genesis,
  leafHash,
  type Manifest,
  readAttestations,
  readHead,
  type VersionRecord,
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
  /** The chain's version at the last entry the walk reached (1 or 2); null when it reached no genesis. */
  version: number | null;
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
    /** Attestations chained, as a digest, with their events (version 2); counted from the entries, so in a failed report too. */
    attested: number;
    /** Attestation rows of events chained under version 1 or before the chain began: nothing vouches for them. */
    attestations_uncovered: number;
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
  /** The operator's public key, pinned: a checkpoint signed under any other fails; without it the verdict is at best UNSIGNED. */
  pin?: string;
  /** Checkpoints the operator kept outside the log; the log must extend each. */
  held?: Checkpoint[];
}

const b64 = (hex: string) => Buffer.from(hex, "hex").toString("base64");

/** The hex of a canonical standard base64 encoding of 32 bytes, or null (C2SP: decoders reject anything else). */
function hash32(text: string): string | null {
  const bytes = Buffer.from(text, "base64");
  if (bytes.length !== 32 || bytes.toString("base64") !== text) return null;
  return bytes.toString("hex");
}

/** The C2SP tlog-checkpoint body of a checkpoint. */
export function checkpointNote(log: string, size: number, root: string, head: string, at: string) {
  return `engram.log/${log}\n${size}\n${b64(root)}\nhead ${b64(head)}\ntime ${at}\n`;
}

/**
 * The fields of a checkpoint note, or null when it is not one: a decimal size
 * with no leading zero, and each hash 32 bytes in canonical base64, as C2SP's
 * tlog-checkpoint requires of a decoder (E1.6-10).
 */
export function parseNote(
  note: string,
): { log: string; size: number; root: string; head: string; at: string } | null {
  const m =
    /^engram\.log\/([0-9a-f]+)\n(0|[1-9][0-9]*)\n([A-Za-z0-9+/=]+)\nhead ([A-Za-z0-9+/=]+)\ntime (\S+)\n$/.exec(
      note,
    );
  if (!m) return null;
  const [, log, size, root, head, at] = m as unknown as string[];
  const r = hash32(root as string);
  const h = hash32(head as string);
  if (r === null || h === null || !Number.isSafeInteger(Number(size))) return null;
  return { log: log as string, size: Number(size), root: r, head: h, at: at as string };
}

const COLUMNS = ["id", "op", "item_id", "actor", "scope_from", "scope_to", "decision"] as const;

/** A JSON object: not null, not an array. */
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A list of seqs: non-negative integers. */
const isSeqs = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every((x) => Number.isSafeInteger(x) && (x as number) >= 0);

function parsed(text: unknown): unknown {
  try {
    return JSON.parse(String(text));
  } catch {
    return undefined;
  }
}

interface Walk {
  checks: Check[];
  failure: Break | null;
  genesis: Genesis | null;
  version: number | null;
  leaves: string[];
  hashes: string[];
  counts: ChainReport["counts"];
}

/** The checks up to `commitments`. */
function walk(db: Db): Walk {
  const checks: Check[] = [];
  const counts = {
    entries: 0,
    events: 0,
    unchained: 0,
    erased: 0,
    manifests: 0,
    checkpoints: 0,
    attested: 0,
    attestations_uncovered: 0,
  };
  const out: Walk = {
    checks,
    failure: null,
    genesis: null,
    version: null,
    leaves: [],
    hashes: [],
    counts,
  };
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
  const g = parsed(first.data);
  if (!isRecord(g)) return fail("genesis", "the genesis record is not a JSON object", 0);
  const genesis = g as unknown as Genesis;
  const genesisText = chainCanonical(genesis);
  if (
    genesisText !== String(first.data) ||
    genesis.kind !== "genesis" ||
    !Number.isSafeInteger(genesis.version) ||
    genesis.version < 1 ||
    genesis.version > CHAIN_VERSION ||
    typeof genesis.log !== "string" ||
    !/^[0-9a-f]+$/.test(genesis.log) ||
    !Number.isSafeInteger(genesis.start) ||
    genesis.start < 0
  )
    return fail(
      "genesis",
      `the genesis record is not one this chain writes: ${String(first.data)}`,
      0,
    );
  const genesisLeaf = leafHash(genesisText);
  const genesisHash = chainLink(CHAIN_SEED, genesisLeaf);
  if (genesisHash !== String(first.hash))
    return fail("genesis", "the genesis's hash does not link from the chain's seed", 0);
  out.genesis = genesis;
  out.version = genesis.version;
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
  /** seq to the position of the first manifest that names it. */
  const named = new Map<number, number>();
  /** By position, the seq of an event entry, null for any other entry. */
  const entrySeq: (number | null)[] = [null];
  /** Erase events a manifest already named: each belongs to one manifest only. */
  const usedErase = new Set<number>();
  /** Events chained under version 2, by seq, to the attestation digest their entry names (undefined: none). */
  const digests = new Map<number, string | undefined>();
  let version = genesis.version;
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
      const b = parsed(stored.body);
      if (!isRecord(b)) return fail("links", `event ${seq}'s body is not a JSON object`, pos, seq);
      const body = b as unknown as MemoryEvent;
      if (body.seq !== seq)
        return fail("links", `event ${seq}'s body says seq ${String(body.seq)}: moved`, pos, seq);
      for (const column of COLUMNS)
        if ((stored[column] ?? null) !== (body[column] ?? null))
          return fail(
            "links",
            `event ${seq}'s ${column} column (${String(stored[column])}) differs from its body (${String(body[column])})`,
            pos,
            seq,
          );
      const c = parsed(row.data);
      if (!isRecord(c) || !Object.values(c).every((v) => typeof v === "string"))
        return fail(
          "links",
          `event ${seq}'s commitments are not a JSON object of strings`,
          pos,
          seq,
        );
      const { [ATTESTATION_KEY]: digest, ...commits } = c as Record<string, string>;
      if (digest !== undefined && version < 2)
        return fail(
          "links",
          `event ${seq}'s entry carries an attestation digest under chain version ${version}, which chains none`,
          pos,
          seq,
        );
      const expected = [...committedParts(body).keys()].sort().join(",");
      if (Object.keys(commits).sort().join(",") !== expected)
        return fail(
          "links",
          `event ${seq} commits to [${Object.keys(commits).sort().join(", ")}], where its body has [${expected}]`,
          pos,
          seq,
        );
      record = eventRecord(body, c as Record<string, string>);
      if (version >= 2) digests.set(seq, digest);
      bodies.set(seq, body);
      given.set(seq, commits);
      entryPos.set(seq, pos);
      counts.events++;
      next++;
    } else if (row.kind === "manifest") {
      const m = parsed(row.data);
      if (!isRecord(m) || m.kind !== "manifest" || !isSeqs(m.redacted) || !isSeqs(m.erase))
        return fail(
          "links",
          "a manifest record is not one this chain writes: its redacted and erase fields must be lists of seqs",
          pos,
        );
      const manifest = m as unknown as Manifest;
      record = chainCanonical(manifest);
      if (record !== String(row.data))
        return fail("links", "a manifest record is not in the chain's canonical form", pos);
      if (manifest.redacted.length > 0 && manifest.erase.length === 0)
        return fail(
          "links",
          `the manifest names ${manifest.redacted.length} redacted events but no erase event: a redaction no offboarding made`,
          pos,
        );
      // An offboarding appends its erase events and then its manifest in one
      // transaction, so its erase events are exactly the entries just before
      // it, and no other manifest names them (review E1.6-12, the lead's
      // rule): a forger must append a fresh, visible erase event.
      const k = manifest.erase.length;
      for (let t = 0; t < k; t++)
        if (entrySeq[pos - k + t] !== manifest.erase[t])
          return fail(
            "links",
            `the manifest's erase events [${manifest.erase.join(", ")}] are not the entries chained just before it, as an offboarding appends them`,
            pos,
          );
      for (const seq of manifest.erase) {
        if (usedErase.has(seq))
          return fail(
            "links",
            `erase event ${seq} is named by an earlier manifest; each belongs to one`,
            pos,
            seq,
          );
        usedErase.add(seq);
      }
      const erasedItems = new Set<string>();
      for (const seq of manifest.erase) {
        const erase = bodies.get(seq);
        if (erase?.decision !== "allow" || erase.op !== "retire" || erase.policy_id !== ERASURE_ID)
          return fail(
            "links",
            `the manifest names seq ${seq} as an erase event, which no erase event chained before it is`,
            pos,
            seq,
          );
        if (typeof erase.item_id === "string") erasedItems.add(erase.item_id);
      }
      for (const seq of manifest.redacted) {
        const redactedEvent = bodies.get(seq);
        // An item event the manifest names must be about an item its erase
        // events erased; a lint event may be about another item, whose
        // evidence named an erased one, and is accepted beside an erase event.
        if (
          redactedEvent?.item !== undefined &&
          redactedEvent.item !== null &&
          !erasedItems.has(String(redactedEvent.item_id))
        )
          return fail(
            "links",
            `the manifest names event ${seq}, whose item ${String(redactedEvent.item_id)} is not among the items its erase events erased`,
            pos,
            seq,
          );
        if (!named.has(seq)) named.set(seq, pos);
      }
      counts.manifests++;
    } else if (row.kind === "version") {
      const v = parsed(row.data);
      if (!isRecord(v) || v.kind !== "version" || !Number.isSafeInteger(v.version))
        return fail("links", "a version record is not one this chain writes", pos);
      record = chainCanonical(v as unknown as VersionRecord);
      if (record !== String(row.data))
        return fail("links", "a version record is not one this chain writes", pos);
      const to = v.version as number;
      if (to !== version + 1 || to > CHAIN_VERSION)
        return fail(
          "links",
          `the version entry moves the chain to version ${to}, which is not the next version after ${version} (this verifier knows up to ${CHAIN_VERSION})`,
          pos,
        );
      version = to;
    } else {
      return fail(
        "links",
        `an entry of kind ${String(row.kind)} is not one this chain writes`,
        pos,
      );
    }
    const leaf = leafHash(record);
    const hash = chainLink(prev, leaf);
    if (hash !== String(row.hash))
      return fail(
        "links",
        "the entry does not recompute: it, or one before it, was changed",
        pos,
        row.seq === null ? null : Number(row.seq),
      );
    entrySeq.push(row.kind === "event" ? Number(row.seq) : null);
    out.leaves.push(leaf);
    out.hashes.push(hash);
    out.version = version;
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
      `event ${beyond[0]} is not chained: appended by a writer that does not keep the chain, or inserted`,
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

  // Attestations (card E1.9): from version 2 each chained event has exactly
  // the row its entry's digest names.
  const attestationRows = readAttestations(db);
  // Counted from the entries, so a failed report counts them all too (review
  // of card E1.9, finding 6).
  counts.attested = [...digests.values()].filter((d) => d !== undefined).length;
  for (const [seq, digest] of digests) {
    const pos = entryPos.get(seq) ?? null;
    const row = attestationRows.get(seq);
    if (digest === undefined) {
      if (row !== undefined)
        return fail(
          "attestations",
          `event ${seq} has an attestation row, but was chained without one: the row was added after`,
          pos,
          seq,
        );
      continue;
    }
    if (row === undefined)
      return fail(
        "attestations",
        `event ${seq} was chained with an attestation, and its row is gone: deleted`,
        pos,
        seq,
      );
    if (attestationDigest(row) !== digest)
      return fail(
        "attestations",
        `event ${seq}'s attestation row does not match the digest chained with it: edited`,
        pos,
        seq,
      );
  }
  for (const seq of attestationRows.keys()) {
    if (digests.has(seq)) continue;
    if (!events.has(seq))
      return fail(
        "attestations",
        `an attestation row names seq ${seq}, which the log does not hold`,
        null,
        seq,
      );
    // Nothing vouches for an uncovered row, but it must at least name the
    // event at its seq (review of card E1.9, finding 8).
    const rowEvent = attestationRows.get(seq)?.event_id;
    if (rowEvent !== String(events.get(seq)?.id))
      return fail(
        "attestations",
        `the attestation row at seq ${seq} names event ${rowEvent}, which is not the event at that seq`,
        null,
        seq,
      );
    counts.attestations_uncovered++;
  }
  checks.push({ name: "attestations", ok: true });
  return out;
}

/** Whether an erased event's redacted parts hold the marker: redacting it again changes nothing. */
function holdsMarker(event: MemoryEvent): boolean {
  const it = event.item as unknown;
  if (it !== undefined && it !== null) {
    if (!isRecord(it) || !isRecord(it.provenance)) return false;
    if (chainCanonical(redacted(it as unknown as MemoryItem)) !== chainCanonical(it)) return false;
  }
  if (event.op === "lint")
    return typeof event.reason === "string" && redactedLintReason(event.reason) === event.reason;
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

/** What the operator cannot get from the database alone. */
const LIMIT =
  "without a checkpoint held outside the database (log checkpoint --out, then --checkpoint), anyone with database access can cut the tail or rewrite the whole chain, and the verdict is then UNSIGNED, never OK";

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
    version: w.version,
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
  const size = w.leaves.length;

  /** Whether a checkpoint at a size the chain holds recomputes, and whether its signature counts. */
  const judge = (c: Checkpoint, what: string): string | { signed: boolean; size: number } => {
    const f = typeof c.note === "string" ? parseNote(c.note) : null;
    if (!f) return `${what} is not a checkpoint note this log writes`;
    if (f.log !== log) return `${what} is of log ${f.log}, not this log (${log})`;
    if (f.size < 1 || f.size > size)
      return `${what} covers ${f.size} entries, but the chain holds ${size}: its tail was cut`;
    if (merkleRoot(w.leaves.slice(0, f.size)) !== f.root || w.hashes[f.size - 1] !== f.head)
      return `${what} at size ${f.size} does not match the chain at that size: the log was rewritten`;
    if (typeof c.signature !== "string" || typeof c.key !== "string")
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
  const judged: { signed: boolean; size: number }[] = [];
  for (const c of stored) {
    const f = parseNote(c.note);
    if (!f || f.size !== c.size || f.root !== c.root || f.head !== c.head || f.at !== c.at)
      return fail("checkpoints", `checkpoint ${c.n}'s columns differ from its note`);
    const j = judge(c, `checkpoint ${c.n}`);
    if (typeof j === "string") return fail("checkpoints", j);
    judged.push(j);
  }
  w.checks.push({ name: "checkpoints", ok: true });
  for (const [i, c] of (options.held ?? []).entries()) {
    const j = judge(c, `the held checkpoint ${i + 1}`);
    if (typeof j === "string") return fail("held", j);
    judged.push(j);
  }
  if ((options.held ?? []).length > 0) w.checks.push({ name: "held", ok: true });

  // OK only when a signed checkpoint under the pinned key covers the whole chain.
  const signedSizes = judged.filter((j) => j.signed).map((j) => j.size);
  const latestSigned = signedSizes.length > 0 ? Math.max(...signedSizes) : 0;
  const pinned = options.pin !== undefined && options.verify !== undefined;
  report.verdict = pinned && latestSigned === size ? "OK" : "UNSIGNED";
  if (judged.length === 0) notes.push(`no checkpoint: nothing signs this log's head; ${LIMIT}`);
  if (options.verify === undefined)
    notes.push("no signature check was given, so no signature counts and the verdict is UNSIGNED");
  else if (options.pin === undefined)
    notes.push(
      "no public key is pinned (--key), so the verdict is UNSIGNED: a signature proves only that the holder of the key a checkpoint names signed it, and a rewriter can be that holder",
    );
  if (judged.length > 0 && latestSigned === 0)
    notes.push("no checkpoint carries a signature that counts, so the verdict is UNSIGNED");
  if (latestSigned > 0 && latestSigned < size)
    notes.push(
      `${size - latestSigned} chain entries after the latest signed checkpoint are covered by no signature, so the verdict is UNSIGNED; sign a new checkpoint to cover them`,
    );
  if (w.counts.unchained > 0)
    notes.push(
      `${w.counts.unchained} events before seq ${w.genesis.start} were appended before the chain began; nothing vouches for them`,
    );
  const uncovered = w.counts.attestations_uncovered;
  if (uncovered > 0)
    notes.push(
      `${uncovered === 1 ? "1 attestation row belongs" : `${uncovered} attestation rows belong`} to events chained under chain version 1 or before the chain began; nothing vouches for ${uncovered === 1 ? "it" : "them"}`,
    );
  if (w.version !== null && w.version < CHAIN_VERSION)
    notes.push(
      `the chain is at version ${w.version}, which chains no attestation; the next event a writer that keeps the chain appends moves it to version ${CHAIN_VERSION}`,
    );
  if (judged.length > 0 && (options.held ?? []).length === 0) notes.push(LIMIT);
  notes.push(
    "the chain vouches for the log only: an erasure verified here may still have left content in a store (card E1.5, finding E1.5-1); the deletion report and the dogfood report are where that shows",
  );
  return report;
}

/**
 * Writes a checkpoint of the head at time `at`, signed by `signer` when one
 * is given, inside one transaction. Refuses (throws) unless the whole log
 * verifies under `options` first: the chain, every stored checkpoint, every
 * held one and the pinned key (review fix pass, E1.6-2; C2SP: a log never
 * signs a checkpoint inconsistent with one it signed before). A signer whose
 * key is not the pinned one is refused.
 */
export function writeCheckpoint(
  db: Db,
  at: string,
  signer?: CheckpointSigner,
  options: VerifyOptions = {},
): StoredCheckpoint {
  if (!Timestamp.safeParse(at).success) throw new Error(`checkpoint: ${at} is not a UTC timestamp`);
  if (signer && options.pin !== undefined && signer.key !== options.pin)
    throw new Error("checkpoint: the signer's key is not the pinned one; no checkpoint is written");
  return db.transaction(() => {
    const r = verifyChain(db, options);
    if (r.first_break !== null || r.head === null || r.log === null)
      throw new Error(
        `checkpoint: the log does not verify (${r.first_break?.check}: ${r.first_break?.detail}); no checkpoint is written`,
      );
    const { size, root, hash: head } = r.head;
    const note = checkpointNote(r.log, size, root, head, at);
    const signature = signer ? signer.sign(Buffer.from(note, "utf8")) : null;
    const key = signer ? signer.key : null;
    const n = Number(
      db.prepare("SELECT coalesce(max(n) + 1, 0) AS n FROM chain_checkpoints").get()?.n ?? 0,
    );
    db.prepare(
      "INSERT INTO chain_checkpoints (n, size, root, head, at, note, key, signature) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(n, size, root, head, at, note, key, signature);
    return { n, log: r.log, size, root, head, at, note, key, signature };
  });
}

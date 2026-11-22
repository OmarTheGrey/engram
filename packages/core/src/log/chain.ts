// The tamper-evident event log (card E1.6, ADR 0038): a hash chain in side
// tables (migration 5), over a skeleton of each event that holds no content,
// so an offboarding's erasure leaves it verifiable.
//
// The skeleton is the whole event body in canonical form with exactly the
// parts an erasure rewrites (log/redact.ts) swapped for salted commitments:
// in an event carrying an item, its content and its provenance ref, hash and
// session entry id; in a lint event, the evidence after its reason's
// `<lint id> (<severity>): ` head (the whole reason when it has none).
// Everything else, every other reason included, is hashed as it is. Each
// event with committed parts gets one random salt, injected (core draws no
// randomness), kept until an erasure deletes it; the commitments stay in the
// chain, so the chain still verifies, and without the salt a commitment
// confirms no guess of a short value.
//
// The chain is a sequence of entries: a genesis (the backfill checkpoint:
// the log's random id and the seq the chain starts at; events before it are
// stated as unchained), one entry per event in seq order, and one manifest
// per offboarding (the sorted seqs of every event it redacted, and its erase
// events). Leaf i is SHA-256(0x00 || canonical(record i)) and the chain hash
// after it SHA-256(0x01 || hash(i-1) || leaf i), RFC 6962's leaf and node
// prefixes, with hash(-1) a constant of this format. A meta row (chain_head)
// anchors the head hash, the entry count and the last chained seq, so a
// truncated tail is detected. Checkpoints (log/verify.ts) sign the head.
//
// Which handles keep the chain: a handle registered with keepChain, which the
// CLI does with node:crypto randomness. A handle not registered appends no
// link, so research runs and tests pay nothing and change nothing; an event
// such a handle appends to a chained log is reported by the verifier as
// unchained, so a writer that skips the chain is visible, never trusted.
// Appends run inside appendEvent's transaction, under the log's lock (card
// E2.6), so writers on several handles chain in seq order.
//
// Ported in part from huqan (https://github.com/ali-ulu/huqan, commit
// 0cbc5ec8a67407a432d6a4ec3b41082a1c0f118f, lib/hash-chain.js, Apache-2.0):
// one canonical serialisation and digest shared by the writer and the
// verifier, a genesis marker per chain so no other chain's records verify in
// its place, and the stored hash recomputed from its own record. The RFC 6962
// prefixes follow world-model-mcp (MIT, merkle.py, see log/merkle.ts); the
// timestamp and number rules are caura's and Compartment's lessons as the
// research reports them (docs/research/absorb/19-github-scout.md).
import { createHash } from "node:crypto";
import type { Db } from "../db/db.ts";
import type { MemoryEvent } from "../schema.ts";
import { normalTimestamp } from "../time.ts";
import { lintHead } from "./redact.ts";

/** The chain format's version, in every genesis record. */
export const CHAIN_VERSION = 1;

/** hash(-1): the constant the genesis links from (a genesis per log, huqan). */
export const CHAIN_SEED = createHash("sha256").update("engram event log chain v1").digest("hex");

/** Keys whose string values are timestamps (schema.ts Timestamp), canonicalised at nanosecond precision. */
const TIMESTAMP_KEYS = new Set(["ts", "valid_from", "valid_to", "expires"]);

function canon(value: unknown, key: string | null): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new TypeError(`canonicalJson: ${value} is not finite`);
      // ECMAScript's shortest round-trip form, as RFC 8785 uses; -0 is 0.
      return Object.is(value, -0) ? "0" : JSON.stringify(value);
    case "string": {
      if (key !== null && TIMESTAMP_KEYS.has(key)) {
        try {
          return JSON.stringify(normalTimestamp(value));
        } catch {
          // not a timestamp: hashed as it is
        }
      }
      return JSON.stringify(value);
    }
    case "object": {
      if (Array.isArray(value)) return `[${value.map((v) => canon(v, null)).join(",")}]`;
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record)
        .filter((k) => record[k] !== undefined)
        .sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${canon(record[k], k)}`).join(",")}}`;
    }
    default:
      throw new TypeError(`canonicalJson: a ${typeof value} has no canonical form`);
  }
}

/**
 * The one canonical JSON the chain's writer and its verifier share: keys
 * sorted by UTF-16 code unit at every level, no whitespace, numbers in
 * ECMAScript's shortest round-trip form (integral numbers as integers, -0 as
 * 0, never NaN or an infinity), and the timestamps of `ts`, `valid_from`,
 * `valid_to` and `expires` at nanosecond precision in UTC (time.ts
 * normalTimestamp), so two writings of one instant hash alike. An undefined
 * object member is dropped, as JSON drops it; anything else not JSON throws.
 */
export function canonicalJson(value: unknown): string {
  return canon(value, null);
}

const sha256 = (...parts: (string | Uint8Array)[]): Buffer => {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest();
};

/** RFC 6962 leaf hash, SHA-256(0x00 || record), in hex. */
export function leafHash(record: string): string {
  return sha256(Uint8Array.of(0), Buffer.from(record, "utf8")).toString("hex");
}

/** RFC 6962 node hash, SHA-256(0x01 || left || right), of two hex hashes, in hex. */
export function nodeHash(left: string, right: string): string {
  return sha256(Uint8Array.of(1), Buffer.from(left, "hex"), Buffer.from(right, "hex")).toString(
    "hex",
  );
}

/** A part of an event that an erasure may rewrite, and so is committed rather than hashed. */
export type Part =
  | "content"
  | "provenance.ref"
  | "provenance.hash"
  | "provenance.session_entry_id"
  | "reason.evidence";

/** A part's value, or its absence (session_entry_id is optional, and an erasure removes it). */
type PartValue = { present: true; value: unknown } | { present: false };

/** The parts of `event` the skeleton commits to, by name. */
export function committedParts(event: MemoryEvent): Map<Part, PartValue> {
  const parts = new Map<Part, PartValue>();
  if (event.item) {
    const { provenance } = event.item;
    parts.set("content", { present: true, value: event.item.content });
    parts.set("provenance.ref", { present: true, value: provenance.ref });
    parts.set("provenance.hash", { present: true, value: provenance.hash });
    parts.set(
      "provenance.session_entry_id",
      provenance.session_entry_id === undefined
        ? { present: false }
        : { present: true, value: provenance.session_entry_id },
    );
  }
  if (event.op === "lint") {
    const head = lintHead(event.reason);
    parts.set("reason.evidence", {
      present: true,
      value: head === null ? event.reason : event.reason.slice(head.length),
    });
  }
  return parts;
}

/** A salted commitment to one part: SHA-256 of a domain tag, the salt and the part, in canonical form. */
export function commitment(salt: Uint8Array, part: Part, value: PartValue): string {
  const digest = sha256(
    "engram.commitment.v1\n",
    salt,
    canonicalJson(
      value.present ? { part, present: true, value: value.value } : { part, present: false },
    ),
  );
  return `sha256:${digest.toString("hex")}`;
}

/** The commitments to every committed part of `event` under `salt`. */
export function commitments(event: MemoryEvent, salt: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [part, value] of committedParts(event)) out[part] = commitment(salt, part, value);
  return out;
}

/**
 * The skeleton of `event`: its body with each committed part replaced by its
 * commitment in `given` (a part missing from `given` becomes null, which the
 * verifier reports). It holds no content.
 */
export function skeleton(event: MemoryEvent, given: Readonly<Record<string, string>>): unknown {
  const c = (part: Part) => given[part] ?? null;
  const out: Record<string, unknown> = { ...event };
  if (event.item) {
    const { content: _content, provenance, ...item } = event.item;
    const { ref: _ref, hash: _hash, session_entry_id: _entry, ...rest } = provenance;
    out.item = {
      ...item,
      content: c("content"),
      provenance: {
        ...rest,
        ref: c("provenance.ref"),
        hash: c("provenance.hash"),
        session_entry_id: c("provenance.session_entry_id"),
      },
    };
  }
  if (event.op === "lint")
    out.reason = { head: lintHead(event.reason), evidence: c("reason.evidence") };
  return out;
}

/** The chain record of an event entry, in canonical form: what its leaf hashes. */
export function eventRecord(event: MemoryEvent, given: Readonly<Record<string, string>>): string {
  return canonicalJson({ kind: "event", skeleton: skeleton(event, given) });
}

/** The skeleton hash of `event` under `given` commitments: the leaf of its chain entry. */
export function skeletonHash(event: MemoryEvent, given: Readonly<Record<string, string>>): string {
  return leafHash(eventRecord(event, given));
}

/** A genesis record: the backfill checkpoint. */
export interface Genesis {
  kind: "genesis";
  version: number;
  /** The log's random id, so no other log's chain verifies in its place. */
  log: string;
  /** The first chained seq; events before it were appended before the chain began. */
  start: number;
}

/** An offboarding's manifest record. */
export interface Manifest {
  kind: "manifest";
  /** The sorted seqs of every event the offboarding redacted, item and lint events alike. */
  redacted: number[];
  /** The seqs of its erase events (engram/offboard/erase), chained before the manifest. */
  erase: number[];
}

/** What a handle that keeps the chain is given: its source of salts. */
export interface ChainKeeper {
  /** Fresh random bytes, at least 16 (the CLI gives 32 from node:crypto). */
  salt(): Uint8Array;
}

/** The anchor: the chain's size, last hash and last chained seq. */
export interface ChainHead {
  size: number;
  hash: string;
  seq: number;
}

const keepers = new WeakMap<Db, ChainKeeper>();

/** Whether `db` holds migration 5's chain tables; cached per handle. */
const hasTables = new WeakMap<Db, boolean>();

export function chainTables(db: Db): boolean {
  const known = hasTables.get(db);
  if (known !== undefined) return known;
  const sql =
    db.dialect === "postgres"
      ? "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = current_schema() AND tablename = 'chain_head'"
      : "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'chain_head'";
  const present = Number(db.prepare(sql).get()?.n) > 0;
  if (present) hasTables.set(db, true);
  return present;
}

export function readHead(db: Db): ChainHead | undefined {
  const row = db.prepare("SELECT size, hash, seq FROM chain_head WHERE id = 0").get();
  return row ? { size: Number(row.size), hash: String(row.hash), seq: Number(row.seq) } : undefined;
}

/** The log's genesis record, or undefined when its chain never began. */
export function readGenesis(db: Db): Genesis | undefined {
  const row = db.prepare("SELECT kind, data FROM chain WHERE pos = 0").get();
  if (row?.kind !== "genesis") return undefined;
  return JSON.parse(String(row.data)) as Genesis;
}

function append(db: Db, kind: string, seq: number | null, data: string, record: string): void {
  const head = readHead(db);
  if (!head)
    throw new Error(
      "the event log's chain has no head row (chain_head): it was deleted, or the chain never began",
    );
  const hash = nodeHash(head.hash, leafHash(record));
  db.prepare("INSERT INTO chain (pos, kind, seq, data, hash) VALUES (?, ?, ?, ?, ?)").run(
    head.size,
    kind,
    seq,
    data,
    hash,
  );
  db.prepare("UPDATE chain_head SET size = ?, hash = ?, seq = ? WHERE id = 0").run(
    head.size + 1,
    hash,
    seq ?? head.seq,
  );
}

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

function freshSalt(keeper: ChainKeeper): Uint8Array {
  const salt = keeper.salt();
  if (!(salt instanceof Uint8Array) || salt.length < 16)
    throw new Error("a chain keeper's salt must be at least 16 random bytes");
  return salt;
}

/**
 * Registers `db` as a handle that keeps the chain, with `keeper` as its
 * source of salts, and begins the chain if it has not begun: the genesis,
 * recording the next seq as where the chain starts (the backfill checkpoint;
 * nothing before it is chained, so a migration that rewrote bodies in place
 * cannot break it). Requires migration 5. Returns the genesis.
 */
export function keepChain(db: Db, keeper: ChainKeeper): Genesis {
  if (!chainTables(db))
    throw new Error("the event log has no chain tables; migrate it first (migration 5)");
  const genesis = db.transaction(() => {
    const found = readGenesis(db);
    if (found) return found;
    if (readHead(db) || db.prepare("SELECT pos FROM chain LIMIT 1").get())
      throw new Error("the event log's chain has entries but no genesis: it was tampered with");
    const start = Number(
      db.prepare("SELECT coalesce(max(seq) + 1, 0) AS n FROM events").get()?.n ?? 0,
    );
    const record: Genesis = {
      kind: "genesis",
      version: CHAIN_VERSION,
      log: hex(freshSalt(keeper)),
      start,
    };
    const text = canonicalJson(record);
    const hash = nodeHash(CHAIN_SEED, leafHash(text));
    db.prepare(
      "INSERT INTO chain (pos, kind, seq, data, hash) VALUES (0, 'genesis', NULL, ?, ?)",
    ).run(text, hash);
    db.prepare("INSERT INTO chain_head (id, size, hash, seq) VALUES (0, 1, ?, ?)").run(
      hash,
      start - 1,
    );
    return record;
  });
  keepers.set(db, keeper);
  return genesis;
}

/** Whether this handle keeps the chain (keepChain). */
export function keepsChain(db: Db): boolean {
  return keepers.has(db);
}

/**
 * Chains `event`, just appended inside the caller's transaction (appendEvent),
 * when this handle keeps the chain: its salt, its commitments and its entry.
 * A handle that keeps none returns at once.
 */
export function linkEvent(db: Db, event: MemoryEvent): void {
  const keeper = keepers.get(db);
  if (!keeper) return;
  const parts = committedParts(event);
  let given: Record<string, string> = {};
  if (parts.size > 0) {
    const salt = freshSalt(keeper);
    given = commitments(event, salt);
    db.prepare("INSERT INTO chain_salts (seq, salt) VALUES (?, ?)").run(event.seq, hex(salt));
  }
  append(db, "event", event.seq, canonicalJson(given), eventRecord(event, given));
}

/**
 * Deletes the salts of the events an erasure redacted, on every handle that
 * holds the chain tables, kept or not: with its salt, a commitment would
 * confirm a guess of the erased content.
 */
export function forgetSalts(db: Db, seqs: readonly number[]): void {
  if (seqs.length === 0 || !chainTables(db)) return;
  const remove = db.prepare("DELETE FROM chain_salts WHERE seq = ?");
  for (const seq of seqs) remove.run(seq);
}

/**
 * Chains an offboarding's manifest, after its erase events, when this handle
 * keeps the chain. A redaction verifies only when a chained manifest names it.
 */
export function chainManifest(db: Db, redacted: readonly number[], erase: readonly number[]): void {
  if (!keepers.has(db)) return;
  const record: Manifest = {
    kind: "manifest",
    redacted: [...new Set(redacted)].sort((a, b) => a - b),
    erase: [...erase].sort((a, b) => a - b),
  };
  const text = canonicalJson(record);
  append(db, "manifest", null, text, text);
}

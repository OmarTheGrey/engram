// Local API keys for a served surface (card E8.12, ADR 0042 decision 1):
// prefixed, stored only as a salted scrypt hash, shown masked, with an
// expiry, compared in constant time. The key file holds, for each key, the
// actor it acts as, set by the operator when the key is created; a key never
// names its own actor at request time.
//
// Copied in part from TencentDB-Agent-Memory
// (https://github.com/TencentCloud/TencentDB-Agent-Memory), commit
// 083c64b11a6748b49278c15f3f0dc77dfd5a99fa, MIT License, Copyright (C) 2026
// Tencent (full notice in NOTICE):
//   - MemoryCore/src/metadata/utils/user-key.ts: the fixed key prefix, the
//     masking that keeps the prefix and the last four characters
//     (maskUserKey), and the expiry test (isUserKeyExpired);
//   - MemoryCore/src/metadata/utils/crypto.ts: the key as prefix plus 24
//     random bytes in base64url (generateUserKey), and the self-describing
//     scrypt hash `$scrypt$N,r,p$<salt>$<hash>` with its constant-time
//     verification (hashPassword, verifyPasswordHash).
// Changed: the prefix is Engram's and a 12-character key id sits between it
// and the secret, so a key is found without trying every hash; the hash is of
// the key, with no pepper (the source's environment configuration removed);
// a hash shorter than 32 bytes or with a cost above 2^20 is refused (the
// source verified a hash cut short); the comments are ours; the password
// generator and the generic masking are not taken.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ActorShape, ProvenanceKind, Scope, Timestamp } from "@engram/core";
import { z } from "zod";

/** The fixed prefix of every Engram API key, so a scanner can find a leaked one. */
export const KEY_PREFIX = "egk_";

/** egk_, a 12-character hex id, _, and 32 base64url characters (24 random bytes). */
const KEY_PATTERN = /^egk_([0-9a-f]{12})_([A-Za-z0-9_-]{32})$/;

/** Random bytes; injected in tests. */
export type Random = (size: number) => Buffer;

/**
 * A new key: the prefix, a 6-byte key id in hex, `_`, and a 24-byte (192-bit)
 * base64url secret, whose characters `[A-Za-z0-9_-]` are safe in a header,
 * a URL and JSON.
 */
export function generateKey(random: Random = randomBytes): string {
  return `${KEY_PREFIX}${random(6).toString("hex")}_${random(24).toString("base64url")}`;
}

/** The key id and secret of a well-formed key, or undefined. */
export function parseKey(key: string): { id: string; secret: string } | undefined {
  const m = KEY_PATTERN.exec(key);
  return m ? { id: m[1] ?? "", secret: m[2] ?? "" } : undefined;
}

/**
 * A key as it is shown: the prefix and id, `****`, and the last four
 * characters of the secret, such as `egk_1a2b3c4d5e6f_****e5fG`. The full
 * secret is shown once, when the key is created.
 */
export function maskKey(id: string, tail: string): string {
  return `${KEY_PREFIX}${id}_****${tail}`;
}

/** Whether a key whose expiry is `expiresAt` (ISO 8601) has expired at `now` (milliseconds). */
export function isKeyExpired(expiresAt: string | null | undefined, now: number): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t <= now;
}

/** The prefix of the stored hash format. */
export const HASH_PREFIX = "$scrypt$";
const SALT_LEN = 16;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 32;
const MAX_SCRYPT_N = 1 << 20;

const scryptHash = (plain: string, salt: Buffer, n: number, r: number, p: number, keylen: number) =>
  scryptSync(Buffer.from(plain, "utf8"), salt, keylen, { N: n, r, p });

/** The stored form of a key: `$scrypt$N,r,p$<salt base64url>$<hash base64url>`. */
export function hashKey(plain: string, random: Random = randomBytes): string {
  const salt = random(SALT_LEN);
  const hash = scryptHash(plain, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P, KEYLEN);
  return `${HASH_PREFIX}${SCRYPT_N},${SCRYPT_R},${SCRYPT_P}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

/** Whether `plain` matches a stored hash; a malformed hash is false, never a throw. */
export function verifyKeyHash(plain: string, stored: string): boolean {
  try {
    if (!stored.startsWith(HASH_PREFIX)) return false;
    const body = stored.slice(HASH_PREFIX.length);
    const firstSep = body.indexOf("$");
    if (firstSep < 0) return false;
    const params = body.slice(0, firstSep).split(",");
    if (params.length !== 3) return false;
    const [n, r, p] = params.map(Number) as [number, number, number];
    if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
    const rest = body.slice(firstSep + 1);
    const secondSep = rest.indexOf("$");
    if (secondSep < 0) return false;
    const salt = Buffer.from(rest.slice(0, secondSep), "base64url");
    const expected = Buffer.from(rest.slice(secondSep + 1), "base64url");
    // Not in the source: scrypt's shorter outputs are prefixes of its longer
    // ones, so a hash cut short would still verify, and a one-byte hash would
    // accept one key in 256. A stored hash shorter than KEYLEN is refused, and
    // so is a cost past MAX_SCRYPT_N, which a crafted file could use to stall.
    if (expected.length < KEYLEN || n > MAX_SCRYPT_N) return false;
    const actual = scryptHash(plain, salt, n, r, p, expected.length);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * The actor a credential acts as (ADR 0042 decision 2): an actor whose
 * memberships are scopes and whose source is stated, since the operator, not
 * the caller, decides the provenance of what it writes.
 */
export const HeldActor = ActorShape.extend({
  memberships: z.array(Scope),
  source: ProvenanceKind,
});
export type HeldActor = z.infer<typeof HeldActor>;

export const KeyRecord = z.strictObject({
  id: z.string().regex(/^[0-9a-f]{12}$/),
  hash: z.string().startsWith(HASH_PREFIX),
  /** The last four characters of the secret, for the masked form only. */
  tail: z.string().length(4),
  actor: HeldActor,
  created: Timestamp,
  expires: Timestamp,
  revoked: Timestamp.nullable(),
});
export type KeyRecord = z.infer<typeof KeyRecord>;

export const KeyFile = z.strictObject({ version: z.literal(1), keys: z.array(KeyRecord) });
export type KeyFile = z.infer<typeof KeyFile>;

/** A key file that cannot be used; the CLI reports it as usage. */
export class KeyFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyFileError";
  }
}

/** The key file at `path`; a missing one is empty when `allowMissing`, else refused. */
export function readKeyFile(path: string, allowMissing = false): KeyFile {
  if (!existsSync(path)) {
    if (allowMissing) return { version: 1, keys: [] };
    throw new KeyFileError(`${path}: no key file; create a key with engram key create`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new KeyFileError(`${path}: not JSON (${(e as Error).message})`);
  }
  const parsed = KeyFile.safeParse(raw);
  if (!parsed.success)
    throw new KeyFileError(
      `${path}: not a key file: ${parsed.error.issues.map((i) => `${i.path.join(".") || "file"}: ${i.message}`).join("; ")}`,
    );
  const ids = new Set<string>();
  for (const k of parsed.data.keys) {
    if (ids.has(k.id)) throw new KeyFileError(`${path}: key id ${k.id} appears twice`);
    ids.add(k.id);
  }
  return parsed.data;
}

/** Writes the key file whole, through a temporary file, readable by its owner only. */
export function writeKeyFile(path: string, file: KeyFile): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  writeFileSync(temp, `${JSON.stringify(KeyFile.parse(file), null, 2)}\n`, { mode: 0o600 });
  renameSync(temp, path);
}

/** Creates a key for `actor`, records its hash and returns the key, which is never stored. */
export function createKey(
  path: string,
  options: { actor: HeldActor; expires: string; now: string; random?: Random },
): { key: string; record: KeyRecord } {
  const actor = HeldActor.parse(options.actor);
  if (Date.parse(options.expires) <= Date.parse(options.now))
    throw new KeyFileError(`--expires ${options.expires} is not after now (${options.now})`);
  const file = readKeyFile(path, true);
  const random = options.random ?? randomBytes;
  let key = generateKey(random);
  // A repeated id is astronomically unlikely; it is drawn again rather than refused.
  while (file.keys.some((k) => k.id === parseKey(key)?.id)) key = generateKey(random);
  const { id, secret } = parseKey(key) as { id: string; secret: string };
  const record: KeyRecord = {
    id,
    hash: hashKey(key, random),
    tail: secret.slice(-4),
    actor,
    created: options.now,
    expires: options.expires,
    revoked: null,
  };
  writeKeyFile(path, { version: 1, keys: [...file.keys, record] });
  return { key, record };
}

/** Marks a key revoked at `now`; a revoked key stays listed, never accepted again. */
export function revokeKey(path: string, id: string, now: string): KeyRecord {
  const file = readKeyFile(path);
  const found = file.keys.find((k) => k.id === id || maskKey(k.id, k.tail) === id);
  if (found === undefined) throw new KeyFileError(`${path}: no key ${id}`);
  const revoked = { ...found, revoked: found.revoked ?? now };
  writeKeyFile(path, {
    version: 1,
    keys: file.keys.map((k) => (k.id === found.id ? revoked : k)),
  });
  return revoked;
}

export type KeyStatus = "active" | "expired" | "revoked";

/** The status of a key at `now` (ISO 8601). */
export function keyStatus(record: KeyRecord, now: string): KeyStatus {
  if (record.revoked !== null) return "revoked";
  return isKeyExpired(record.expires, Date.parse(now)) ? "expired" : "active";
}

/** Each key as `engram key list` shows it: masked, never its hash. */
export function listKeys(path: string, now: string) {
  return readKeyFile(path, true).keys.map((k) => ({
    id: k.id,
    key: maskKey(k.id, k.tail),
    actor: k.actor,
    created: k.created,
    expires: k.expires,
    status: keyStatus(k, now),
  }));
}

export type KeyCheck = { ok: true; record: KeyRecord } | { ok: false; reason: string };

/** What a served surface checks keys with. */
export interface KeyStore {
  readonly path: string;
  /** The key's record when it is well formed, known, matches its hash, unrevoked and unexpired at `now`. */
  verify(key: string, now: string): KeyCheck;
  /** How many keys are active at `now`; doctor reports it. */
  active(now: string): number;
}

const digest = (text: string) => createHash("sha256").update(text).digest("hex");

/**
 * The key file at `path` as a served surface reads it: loaded now (a bad file
 * is refused at start) and again whenever its size or modification time
 * changes, so a revocation takes effect at the next request. A key that
 * matched its hash is remembered for the process by a SHA-256 digest of the
 * whole key and the stored hash it matched, so scrypt runs once per key, not
 * once per request; the record is still read, revoked and expiry checked,
 * every time. A key whose id is unknown is still run through scrypt once, so
 * the time of a refusal does not tell a known id from an unknown one.
 */
export function openKeyStore(path: string): KeyStore {
  let file = readKeyFile(path);
  let seen = stamp(path);
  const verified = new Map<string, string>();
  let dummy: string | undefined;
  const current = () => {
    const now = stamp(path);
    if (now !== seen) {
      file = readKeyFile(path);
      seen = now;
    }
    return file;
  };
  return {
    path,
    verify(key, now) {
      const parsed = parseKey(key);
      if (parsed === undefined) return { ok: false, reason: "not an Engram API key" };
      const record = current().keys.find((k) => k.id === parsed.id);
      if (record === undefined) {
        dummy ??= hashKey(generateKey());
        verifyKeyHash(key, dummy);
        return { ok: false, reason: "unknown API key" };
      }
      const d = digest(key);
      if (verified.get(d) !== record.hash) {
        if (!verifyKeyHash(key, record.hash)) return { ok: false, reason: "unknown API key" };
        verified.set(d, record.hash);
      }
      const status = keyStatus(record, now);
      if (status !== "active") return { ok: false, reason: `API key ${record.id} is ${status}` };
      return { ok: true, record };
    },
    active: (now) => current().keys.filter((k) => keyStatus(k, now) === "active").length,
  };
}

function stamp(path: string): string {
  try {
    const s = statSync(path);
    return `${s.size}:${s.mtimeMs}`;
  } catch {
    return "missing";
  }
}

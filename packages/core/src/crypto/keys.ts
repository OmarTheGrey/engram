// Per-person data keys for crypto-shredded erasure (card E9.11, ADR XXXX).
//
// Each person scope may hold one live data key, a 256-bit key that card
// E9.13 seals that scope's content under. The key is stored only wrapped,
// under an operator key the core never sees: an injected KeyProvider draws the
// fresh key, wraps it and unwraps it, and core keeps the wrapped bytes in the
// side table `data_keys` (migration 7). Shredding deletes the wrapped bytes
// and keeps a content-free tombstone, so nothing the plane holds opens that
// scope's ciphertext again; rotating the operator key afterwards (rewrapping
// every live key under a new one and destroying the old) is what reaches a
// copy of the table taken before the shred, such as a backup.
//
// The design is ported from Compartment's per-record keys
// (MaxFreedomPollard/Compartment, src/compartment/crypto.py and wire.py at
// 98d4917181c04e5efa41e82ba455b25084edc99f, Apache-2.0): a data key wrapped
// under a master key with the unit's id as associated data, and destruction
// of the wrapped key as the erasure. Here the unit is a person scope and its
// key version, not a record; no code was copied (docs/absorbed.md).
//
// Core reads no clock and draws no randomness: every time is passed in, and
// every random byte comes from the provider. Core does no key I/O: the
// operator key lives behind the provider.
import type { Db } from "../db/db.ts";
import { PersonScope, Timestamp } from "../schema.ts";

/** A data key's length in bytes: 256 bits. */
export const DATA_KEY_BYTES = 32;

/**
 * What core is given at the boundary to hold data keys. The operator key
 * (key-encryption key) stays inside it; core sees its id only. `wrap` and
 * `unwrap` must be authenticated encryption over the associated data core
 * passes, so a wrapped key moved to another scope or version, or edited,
 * fails to unwrap. Nonces: a nonce-based wrap (AES-256-GCM) draws a fresh
 * random 96-bit nonce for every wrap and stores it with the wrapped bytes,
 * since one nonce reused under one operator key leaks the XOR of the two data
 * keys and lets wraps be forged; a misuse-resistant wrap (AES-GCM-SIV, or
 * AES-KW per RFC 5649 with the associated data bound in) needs none. Core
 * cannot check this; the provider's own tests must (two wraps of one key
 * differ). The interface is synchronous (ADR 0024) and is called inside the
 * log's transaction, so a provider over a network key service must present a
 * local, synchronous wrap, for instance by holding an unwrapped operator key.
 */
export interface KeyProvider {
  /** The id of the operator key that wraps new data keys, recorded per row. */
  readonly kek: string;
  /** The wrap algorithm's name, recorded per row (for example `aes-256-gcm`). */
  readonly alg: string;
  /** DATA_KEY_BYTES fresh random bytes. */
  newDataKey(): Uint8Array;
  /** `dataKey` wrapped under the operator key `kek`, bound to `aad`. */
  wrap(dataKey: Uint8Array, aad: Uint8Array): Uint8Array;
  /** The data key `wrapped` holds under the operator key named `kek`; throws when it does not authenticate. */
  unwrap(wrapped: Uint8Array, aad: Uint8Array, kek: string): Uint8Array;
}

/** An unwrapped data key, held in memory only. */
export interface DataKey {
  scope: string;
  version: number;
  kek: string;
  key: Uint8Array;
}

/** What the table says of a scope's latest key, with no key bytes. */
export type DataKeyState =
  | { state: "none" }
  | { state: "live"; version: number; kek: string; alg: string; created_at: string }
  | { state: "shredded"; version: number; shredded_at: string };

/** A data key could not be made or opened: a bad scope or time, a provider's bad answer, or a wrapped key that does not authenticate. */
export class DataKeyError extends Error {
  override readonly name: string = "DataKeyError";
}

/** The scope's key was shredded: its content is erased, and the scope is not re-keyed. */
export class DataKeyShreddedError extends DataKeyError {
  override readonly name = "DataKeyShreddedError";
  readonly scope: string;
  readonly version: number;
  constructor(scope: string, version: number) {
    super(`the data key of ${scope} (version ${version}) was shredded`);
    this.scope = scope;
    this.version = version;
  }
}

const AAD_TAG = "engram.data-key.v1";

/** The associated data a data key is wrapped under: a tag, the scope and the version, NUL-separated. */
export function dataKeyAad(scope: string, version: number): Uint8Array {
  return new TextEncoder().encode(`${AAD_TAG}\u0000${scope}\u0000${version}`);
}

function checkScope(scope: string): void {
  if (!PersonScope.safeParse(scope).success)
    throw new DataKeyError(`only a person scope has a data key, not ${JSON.stringify(scope)}`);
}

function checkTime(at: string): void {
  if (!Timestamp.safeParse(at).success)
    throw new DataKeyError(`not an ISO 8601 UTC time: ${JSON.stringify(at)}`);
}

function checkKey(key: unknown, what: string): Uint8Array {
  if (!(key instanceof Uint8Array) || key.length !== DATA_KEY_BYTES)
    throw new DataKeyError(`${what} must be ${DATA_KEY_BYTES} bytes`);
  return key;
}

const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");
const unhex = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "hex"));

interface KeyRow {
  version: number;
  kek: string;
  alg: string;
  wrapped: string | null;
  created_at: string;
  shredded_at: string | null;
}

function latest(db: Db, scope: string): KeyRow | undefined {
  const r = db
    .prepare(
      "SELECT version, kek, alg, wrapped, created_at, shredded_at FROM data_keys WHERE scope = ? ORDER BY version DESC LIMIT 1",
    )
    .get(scope);
  if (!r) return undefined;
  return {
    version: Number(r.version),
    kek: String(r.kek),
    alg: String(r.alg),
    wrapped: r.wrapped === null || r.wrapped === undefined ? null : String(r.wrapped),
    created_at: String(r.created_at),
    shredded_at:
      r.shredded_at === null || r.shredded_at === undefined ? null : String(r.shredded_at),
  };
}

function opened(provider: KeyProvider, scope: string, row: KeyRow): DataKey {
  if (row.wrapped === null) throw new DataKeyShreddedError(scope, row.version);
  if (row.alg !== provider.alg)
    throw new DataKeyError(
      `the data key of ${scope} (version ${row.version}) was wrapped with ${row.alg}, not this provider's ${provider.alg}`,
    );
  let key: Uint8Array;
  try {
    key = provider.unwrap(unhex(row.wrapped), dataKeyAad(scope, row.version), row.kek);
  } catch (e) {
    throw new DataKeyError(
      `the data key of ${scope} (version ${row.version}) does not open under operator key ${row.kek}: ${(e as Error).message}`,
    );
  }
  return { scope, version: row.version, kek: row.kek, key: checkKey(key, "an unwrapped data key") };
}

/**
 * `key` wrapped by `provider` for `scope` and `version`, checked before it is
 * stored: longer than the key, and opening again under the provider to the
 * same key. A provider with a wrong key or a broken wrap is refused here, so
 * it never commits bytes that do not open (a rotation is followed by
 * destroying the old operator key, after which nothing could recover them).
 */
function wrapChecked(
  provider: KeyProvider,
  key: Uint8Array,
  scope: string,
  version: number,
): Uint8Array {
  const aad = dataKeyAad(scope, version);
  const wrapped = provider.wrap(key, aad);
  if (!(wrapped instanceof Uint8Array) || wrapped.length <= DATA_KEY_BYTES)
    throw new DataKeyError("a provider's wrapped key must be longer than the key it wraps");
  let back: Uint8Array;
  try {
    back = provider.unwrap(wrapped, aad, provider.kek);
  } catch (e) {
    throw new DataKeyError(
      `a key wrapped under operator key ${provider.kek} does not open again: ${(e as Error).message}`,
    );
  }
  if (!(back instanceof Uint8Array) || !Buffer.from(back).equals(Buffer.from(key)))
    throw new DataKeyError(
      `a key wrapped under operator key ${provider.kek} opens to a different key`,
    );
  return wrapped;
}

/** What the table says of `scope`'s latest key; never key bytes. */
export function dataKeyState(db: Db, scope: string): DataKeyState {
  const row = latest(db, scope);
  if (!row) return { state: "none" };
  if (row.wrapped === null)
    return { state: "shredded", version: row.version, shredded_at: row.shredded_at ?? "" };
  return {
    state: "live",
    version: row.version,
    kek: row.kek,
    alg: row.alg,
    created_at: row.created_at,
  };
}

/**
 * `scope`'s live data key, unwrapped; undefined when it has none. Throws
 * DataKeyShreddedError when its latest key was shredded, and DataKeyError
 * when the wrapped key does not open.
 */
export function openDataKey(db: Db, provider: KeyProvider, scope: string): DataKey | undefined {
  checkScope(scope);
  const row = latest(db, scope);
  return row ? opened(provider, scope, row) : undefined;
}

/**
 * `scope`'s live data key, made on first use: drawn from the provider,
 * wrapped under its operator key and stored at `at`, in one transaction, so
 * two handles of one log that ensure at once agree on one key. A scope whose
 * key was shredded is not re-keyed (DataKeyShreddedError): ADR 0010's
 * amendment of 2026-11-21 keeps an offboarded person scope empty until the
 * person is added again, which a later card builds as version n+1.
 */
export function ensureDataKey(db: Db, provider: KeyProvider, scope: string, at: string): DataKey {
  checkScope(scope);
  checkTime(at);
  return db.transaction(() => {
    const row = latest(db, scope);
    if (row) return opened(provider, scope, row);
    const key = checkKey(provider.newDataKey(), "a provider's new data key");
    const version = 1;
    const wrapped = wrapChecked(provider, key, scope, version);
    db.prepare(
      "INSERT INTO data_keys (scope, version, kek, alg, wrapped, created_at, shredded_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
    ).run(scope, version, provider.kek, provider.alg, hex(wrapped), at);
    return { scope, version, kek: provider.kek, key };
  });
}

/**
 * Shreds every live data key of `scope` at `at`: deletes its wrapped bytes
 * and keeps the row as a tombstone (version, operator key id, algorithm,
 * times). Returns the versions shredded, none when there were none.
 * Idempotent. Runs inside the caller's transaction when there is one, so an
 * offboarding that rolls back keeps the key.
 */
export function shredDataKeys(db: Db, scope: string, at: string): number[] {
  checkScope(scope);
  checkTime(at);
  return db.transaction(() => {
    const versions = db
      .prepare(
        "SELECT version FROM data_keys WHERE scope = ? AND wrapped IS NOT NULL ORDER BY version",
      )
      .all(scope)
      .map((r) => Number(r.version));
    if (versions.length > 0)
      db.prepare(
        "UPDATE data_keys SET wrapped = NULL, shredded_at = ? WHERE scope = ? AND wrapped IS NOT NULL",
      ).run(at, scope);
    return versions;
  });
}

/**
 * Rewraps every live data key that `from`'s operator key wraps under `to`'s,
 * in one transaction, and returns the keys rewrapped, by scope and version.
 * Run after a shred and followed by destroying `from`'s operator key, it
 * leaves a shredded key's wrapped copy in a backup or in a database page
 * unopenable (ADR XXXX). The data keys themselves do not change, so content
 * sealed under them still opens.
 */
export function rewrapDataKeys(
  db: Db,
  from: KeyProvider,
  to: KeyProvider,
): { scope: string; version: number }[] {
  if (to.kek === from.kek)
    throw new DataKeyError(
      `a rotation needs a new operator key, and ${to.kek} is the one it replaces`,
    );
  return db.transaction(() => {
    const rows = db
      .prepare(
        "SELECT scope, version, kek, alg, wrapped, created_at, shredded_at FROM data_keys WHERE kek = ? AND wrapped IS NOT NULL ORDER BY scope, version",
      )
      .all(from.kek);
    const done: { scope: string; version: number }[] = [];
    const update = db.prepare(
      "UPDATE data_keys SET kek = ?, alg = ?, wrapped = ? WHERE scope = ? AND version = ?",
    );
    for (const r of rows) {
      const scope = String(r.scope);
      const version = Number(r.version);
      const { key } = opened(from, scope, {
        version,
        kek: String(r.kek),
        alg: String(r.alg),
        wrapped: String(r.wrapped),
        created_at: String(r.created_at),
        shredded_at: null,
      });
      const wrapped = wrapChecked(to, key, scope, version);
      update.run(to.kek, to.alg, hex(wrapped), scope, version);
      done.push({ scope, version });
    }
    return done;
  });
}

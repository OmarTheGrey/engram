// Card E9.11, ADR 0051: the side table of per-person data keys (migration 7)
// and the injected key provider, on SQLite and on embedded Postgres. Core
// draws no randomness and reads no clock: the fake provider's bytes are
// seeded and every time is passed in.
import { expect, test } from "vitest";
import type { KeyProvider } from "../../../src/crypto/keys.ts";
import {
  DATA_KEY_BYTES,
  DataKeyError,
  DataKeyShreddedError,
  dataKeyAad,
  dataKeyState,
  ensureDataKey,
  openDataKey,
  rewrapDataKeys,
  shredDataKeys,
} from "../../../src/crypto/keys.ts";
import { MIGRATIONS, migrate } from "../../../src/db/migrate.ts";
import { forEachBackend, sqliteBackend } from "../../db/backends.ts";
import { fakeKeyProvider } from "../../fakes/key-provider.ts";

const T0 = "2026-11-28T10:00:00.000Z";
const T1 = "2026-11-28T11:00:00.000Z";
const ALICE = "person:alice";
const BOB = "person:bob";

test("migration 7 is the data key table, after every earlier migration", () => {
  const m = MIGRATIONS.find((x) => x.id === 7);
  expect(m?.name).toBe("per-person data keys for crypto-shredded erasure");
  expect(Math.max(...MIGRATIONS.map((x) => x.id))).toBe(7);
});

test("the wrap's associated data names the scope and the version, so a row moved to another scope or version does not open", () => {
  const text = (b: Uint8Array) => Buffer.from(b).toString("utf8");
  expect(text(dataKeyAad(ALICE, 1))).toBe("engram.data-key.v1\u0000person:alice\u00001");
  expect(text(dataKeyAad(ALICE, 2))).not.toBe(text(dataKeyAad(ALICE, 1)));
  expect(text(dataKeyAad(BOB, 1))).not.toBe(text(dataKeyAad(ALICE, 1)));
});

test("the fake provider draws a fresh nonce per wrap: two wraps of one key differ", () => {
  // What ADR 0051 decision 3 asks of every nonce-based provider (E9.13's too).
  const p = fakeKeyProvider();
  const key = new Uint8Array(32).fill(7);
  const aad = dataKeyAad(ALICE, 1);
  const a = p.wrap(key, aad);
  const b = p.wrap(key, aad);
  expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  expect(Buffer.from(a.subarray(0, 12)).equals(Buffer.from(b.subarray(0, 12)))).toBe(false);
  expect(p.unwrap(a, aad, "kek-1")).toEqual(key);
  expect(p.unwrap(b, aad, "kek-1")).toEqual(key);
});

test("ensureDataKey reads and inserts under the log's lock: a racer between the read and the insert waits and fails, and the first key stands", () => {
  // SQLite only: the racer is the other handle of one file, called from
  // inside the first handle's transaction, so it meets BEGIN IMMEDIATE's lock
  // at once (a short busy timeout). Without the transaction the racer would
  // insert version 1 first and the first handle's insert would fail.
  const [a, b] = sqliteBackend.pair();
  migrate(a);
  b.exec("PRAGMA busy_timeout = 50");
  const base = fakeKeyProvider();
  let racer: unknown;
  const racing: KeyProvider = {
    ...base,
    newDataKey() {
      try {
        ensureDataKey(b, fakeKeyProvider({ seed: "racer" }), ALICE, T1);
      } catch (e) {
        racer = e;
      }
      return base.newDataKey();
    },
  };
  const made = ensureDataKey(a, racing, ALICE, T0);
  expect(String(racer)).toMatch(/locked|busy/i);
  expect(openDataKey(b, base, ALICE)?.key).toEqual(made.key);
  expect(Number(b.prepare("SELECT count(*) AS n FROM data_keys").get()?.n)).toBe(1);
  a.close();
  b.close();
});

forEachBackend((backend) => {
  const fresh = () => {
    const db = backend.open();
    migrate(db);
    return db;
  };

  test("the migration creates the table on a fresh log and on one already at migration 6", () => {
    const db = backend.open();
    migrate(
      db,
      MIGRATIONS.filter((m) => m.id < 7),
    );
    expect(migrate(db)).toEqual([7]);
    const cols = db
      .prepare(
        backend.name === "sqlite"
          ? "SELECT name FROM pragma_table_info('data_keys') ORDER BY name"
          : "SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'data_keys' AND table_schema = current_schema() ORDER BY column_name",
      )
      .all()
      .map((r) => r.name);
    expect(cols).toEqual([
      "alg",
      "created_at",
      "kek",
      "scope",
      "shredded_at",
      "version",
      "wrapped",
    ]);
    expect(migrate(db)).toEqual([]);
  });

  test("a person scope's first key is drawn from the provider, wrapped, stored, and opens again", () => {
    const db = fresh();
    const provider = fakeKeyProvider();
    expect(dataKeyState(db, ALICE)).toEqual({ state: "none" });
    expect(openDataKey(db, provider, ALICE)).toBeUndefined();
    const made = ensureDataKey(db, provider, ALICE, T0);
    expect(made.scope).toBe(ALICE);
    expect(made.version).toBe(1);
    expect(made.key.length).toBe(DATA_KEY_BYTES);
    expect(made.kek).toBe("kek-1");
    // Never the key itself in the table: only its wrapped form.
    const row = db.prepare("SELECT * FROM data_keys WHERE scope = ?").get(ALICE);
    expect(String(row?.wrapped)).not.toContain(Buffer.from(made.key).toString("hex"));
    expect(row).toMatchObject({ alg: "aes-256-gcm", kek: "kek-1", created_at: T0 });
    expect(row?.shredded_at).toBeNull();
    const again = ensureDataKey(db, provider, ALICE, T1);
    expect(again.version).toBe(1);
    expect(Buffer.from(again.key).equals(Buffer.from(made.key))).toBe(true);
    expect(openDataKey(db, provider, ALICE)?.key).toEqual(made.key);
    expect(dataKeyState(db, ALICE)).toEqual({
      state: "live",
      version: 1,
      kek: "kek-1",
      alg: "aes-256-gcm",
      created_at: T0,
    });
  });

  test("two people get two keys", () => {
    const db = fresh();
    const provider = fakeKeyProvider();
    const a = ensureDataKey(db, provider, ALICE, T0);
    const b = ensureDataKey(db, provider, BOB, T0);
    expect(Buffer.from(a.key).equals(Buffer.from(b.key))).toBe(false);
  });

  test("two handles of one log that ensure at once agree on one key", () => {
    const [a, b] = backend.pair();
    migrate(a);
    migrate(b);
    const provider = fakeKeyProvider();
    const ka = ensureDataKey(a, provider, ALICE, T0);
    const kb = ensureDataKey(b, provider, ALICE, T1);
    expect(kb.version).toBe(1);
    expect(kb.key).toEqual(ka.key);
    expect(Number(b.prepare("SELECT count(*) AS n FROM data_keys").get()?.n)).toBe(1);
  });

  test("only a person scope has a data key", () => {
    const db = fresh();
    const provider = fakeKeyProvider();
    for (const scope of ["role:eng", "team:core", "org", "person:", "alice"])
      expect(() => ensureDataKey(db, provider, scope, T0)).toThrow(DataKeyError);
    expect(Number(db.prepare("SELECT count(*) AS n FROM data_keys").get()?.n)).toBe(0);
  });

  test("core checks what the provider gives it: a short key, a time that is not one", () => {
    const db = fresh();
    const short = fakeKeyProvider({ newDataKey: () => new Uint8Array(16) });
    expect(() => ensureDataKey(db, short, ALICE, T0)).toThrow(/32 bytes/);
    expect(() => ensureDataKey(db, fakeKeyProvider(), ALICE, "yesterday")).toThrow(DataKeyError);
    expect(dataKeyState(db, ALICE)).toEqual({ state: "none" });
  });

  test("a wrapped key edited, moved to another scope, or opened under another operator key does not open", () => {
    const db = fresh();
    const provider = fakeKeyProvider();
    ensureDataKey(db, provider, ALICE, T0);
    ensureDataKey(db, provider, BOB, T0);
    const wrapped = (s: string) =>
      String(db.prepare("SELECT wrapped FROM data_keys WHERE scope = ?").get(s)?.wrapped);
    // Bob's row given Alice's wrapped bytes: the associated data names Bob.
    db.prepare("UPDATE data_keys SET wrapped = ? WHERE scope = ?").run(wrapped(ALICE), BOB);
    expect(() => openDataKey(db, provider, BOB)).toThrow(DataKeyError);
    // One flipped hex digit in Alice's.
    const w = wrapped(ALICE);
    const flipped = (w[0] === "0" ? "1" : "0") + w.slice(1);
    db.prepare("UPDATE data_keys SET wrapped = ? WHERE scope = ?").run(flipped, ALICE);
    expect(() => openDataKey(db, provider, ALICE)).toThrow(DataKeyError);
    // A different operator key cannot open a row the first one wrapped.
    const db2 = fresh();
    ensureDataKey(db2, provider, ALICE, T0);
    expect(() => openDataKey(db2, fakeKeyProvider({ seed: "other" }), ALICE)).toThrow(DataKeyError);
  });

  test("shredding destroys the wrapped key and keeps a content-free tombstone; nothing opens or re-keys it", () => {
    const db = fresh();
    const provider = fakeKeyProvider();
    ensureDataKey(db, provider, ALICE, T0);
    ensureDataKey(db, provider, BOB, T0);
    expect(shredDataKeys(db, ALICE, T1)).toEqual([1]);
    const row = db.prepare("SELECT * FROM data_keys WHERE scope = ?").get(ALICE);
    expect(row?.wrapped).toBeNull();
    expect(row?.shredded_at).toBe(T1);
    expect(dataKeyState(db, ALICE)).toEqual({ state: "shredded", version: 1, shredded_at: T1 });
    expect(() => openDataKey(db, provider, ALICE)).toThrow(DataKeyShreddedError);
    expect(() => ensureDataKey(db, provider, ALICE, T1)).toThrow(DataKeyShreddedError);
    // Idempotent, and Bob's key is untouched.
    expect(shredDataKeys(db, ALICE, T1)).toEqual([]);
    expect(openDataKey(db, provider, BOB)?.version).toBe(1);
    // Shredding a scope with no key records nothing.
    expect(shredDataKeys(db, "person:carol", T1)).toEqual([]);
    expect(dataKeyState(db, "person:carol")).toEqual({ state: "none" });
  });

  test("a shred inside a transaction that rolls back leaves the key", () => {
    const db = fresh();
    const provider = fakeKeyProvider();
    ensureDataKey(db, provider, ALICE, T0);
    expect(() =>
      db.transaction(() => {
        shredDataKeys(db, ALICE, T1);
        throw new Error("offboarding failed");
      }),
    ).toThrow("offboarding failed");
    expect(openDataKey(db, provider, ALICE)?.version).toBe(1);
  });

  test("rotating the operator key after a shred leaves a copy taken before the shred unopenable once the old key is destroyed", () => {
    const db = fresh();
    const old = fakeKeyProvider({ seed: "old", kek: "kek-1" });
    const alice = ensureDataKey(db, old, ALICE, T0);
    const bob = ensureDataKey(db, old, BOB, T0);
    // The backup: Alice's wrapped key as it stood before the shred.
    const backup = String(
      db.prepare("SELECT wrapped FROM data_keys WHERE scope = ?").get(ALICE)?.wrapped,
    );
    shredDataKeys(db, ALICE, T1);
    const next = fakeKeyProvider({ seed: "new", kek: "kek-2" });
    expect(rewrapDataKeys(db, old, next)).toEqual([{ scope: BOB, version: 1 }]);
    expect(dataKeyState(db, BOB)).toMatchObject({ state: "live", kek: "kek-2" });
    expect(openDataKey(db, next, BOB)?.key).toEqual(bob.key);
    // While the old operator key exists, the backup still opens: rotation is
    // what reaches backups, and only once the old key is destroyed.
    const aad = dataKeyAad(ALICE, 1);
    expect(old.unwrap(Buffer.from(backup, "hex"), aad, "kek-1")).toEqual(alice.key);
    old.keks.delete("kek-1");
    expect(() => old.unwrap(Buffer.from(backup, "hex"), aad, "kek-1")).toThrow();
    expect(() => next.unwrap(Buffer.from(backup, "hex"), aad, "kek-1")).toThrow();
    // A second rotation finds nothing left under kek-1.
    expect(rewrapDataKeys(db, old, next)).toEqual([]);
  });
  test("core checks what the provider gives it: an unwrapped key of the wrong length, a wrap no longer than the key, a wrap that does not open again", () => {
    const db = fresh();
    const p = fakeKeyProvider();
    ensureDataKey(db, p, ALICE, T0);
    const short: KeyProvider = { ...p, unwrap: (w, a, k) => p.unwrap(w, a, k).subarray(0, 16) };
    expect(() => openDataKey(db, short, ALICE)).toThrow(/32 bytes/);
    const bare: KeyProvider = { ...p, wrap: (key) => key, unwrap: (w) => w };
    expect(() => ensureDataKey(db, bare, BOB, T0)).toThrow(/longer than the key/);
    const lossy: KeyProvider = { ...p, unwrap: () => new Uint8Array(32) };
    expect(() => ensureDataKey(db, lossy, BOB, T0)).toThrow(/opens to a different key/);
    expect(dataKeyState(db, BOB)).toEqual({ state: "none" });
  });

  test("a row whose algorithm is not the provider's does not open", () => {
    const db = fresh();
    const p = fakeKeyProvider();
    ensureDataKey(db, p, ALICE, T0);
    expect(() => openDataKey(db, { ...p, alg: "aes-256-kw" }, ALICE)).toThrow(
      /wrapped with aes-256-gcm/,
    );
    db.prepare("UPDATE data_keys SET alg = 'none' WHERE scope = ?").run(ALICE);
    expect(() => openDataKey(db, p, ALICE)).toThrow(DataKeyError);
  });

  test("times are core's ISO 8601 UTC timestamps", () => {
    const db = fresh();
    const p = fakeKeyProvider();
    for (const at of ["2026-11-28T12:00:00+02:00", "2026-11-28", "Sat, 28 Nov 2026 10:00:00 GMT"])
      expect(() => ensureDataKey(db, p, ALICE, at)).toThrow(DataKeyError);
    expect(dataKeyState(db, ALICE)).toEqual({ state: "none" });
  });

  test("a rotation refuses the same operator key, and one whose new wraps do not open commits nothing", () => {
    const db = fresh();
    const old = fakeKeyProvider({ seed: "old", kek: "kek-1" });
    const alice = ensureDataKey(db, old, ALICE, T0);
    ensureDataKey(db, old, BOB, T0);
    expect(() => rewrapDataKeys(db, old, fakeKeyProvider({ seed: "x", kek: "kek-1" }))).toThrow(
      /new operator key/,
    );
    const good = fakeKeyProvider({ seed: "new", kek: "kek-2" });
    const broken: KeyProvider = {
      ...good,
      unwrap: () => {
        throw new Error("wrong key");
      },
    };
    expect(() => rewrapDataKeys(db, old, broken)).toThrow(/does not open again/);
    const lossy: KeyProvider = { ...good, unwrap: () => new Uint8Array(32) };
    expect(() => rewrapDataKeys(db, old, lossy)).toThrow(/different key/);
    expect(dataKeyState(db, ALICE)).toMatchObject({ state: "live", kek: "kek-1" });
    expect(dataKeyState(db, BOB)).toMatchObject({ state: "live", kek: "kek-1" });
    expect(openDataKey(db, old, ALICE)?.key).toEqual(alice.key);
  });
});

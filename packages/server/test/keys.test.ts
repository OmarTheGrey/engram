// Local API keys (card E8.12, ADR 0042 decision 1; keys.ts, copied in part
// from TencentDB-Agent-Memory): prefixed, stored hashed, shown masked, with
// an expiry, compared in constant time; the key file reread when it changes.
// Randomness is a seeded byte stream, so every key is the same on every run.
import { readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  createKey,
  generateKey,
  HASH_PREFIX,
  hashKey,
  isKeyExpired,
  KeyFileError,
  listKeys,
  maskKey,
  openKeyStore,
  parseKey,
  readKeyFile,
  revokeKey,
  verifyKeyHash,
} from "../src/keys.ts";

const NOW = "2026-11-21T12:00:00.000Z";
const LATER = "2026-12-21T12:00:00.000Z";
const dana = {
  id: "person:dana",
  level: "person" as const,
  memberships: ["person:dana"],
  source: "user" as const,
};

/** A seeded byte stream: each call's bytes follow from the seed and the call's number. */
function seeded(seed: number) {
  let call = 0;
  return (size: number) => {
    call++;
    return Buffer.from(
      Array.from({ length: size }, (_, i) => (seed * 131 + call * 59 + i * 17) % 256),
    );
  };
}

const dirs: string[] = [];
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});
async function keyFile() {
  const dir = await mkdtemp(join(tmpdir(), "engram-keys-"));
  dirs.push(dir);
  return join(dir, "keys.json");
}

describe("the key's shape (user-key.ts and crypto.ts)", () => {
  it("is the prefix, a 12-character hex id, and a 32-character base64url secret", () => {
    const key = generateKey(seeded(1));
    expect(key).toMatch(/^egk_[0-9a-f]{12}_[A-Za-z0-9_-]{32}$/);
    expect(parseKey(key)?.id).toHaveLength(12);
    expect(parseKey("sk-mem-abc")).toBeUndefined();
    expect(parseKey(`${key}x`)).toBeUndefined();
  });

  it("is masked to the prefix, the id and the last four characters of the secret", () => {
    expect(maskKey("1a2b3c4d5e6f", "e5fG")).toBe("egk_1a2b3c4d5e6f_****e5fG");
  });

  it("expires at its expiry, and a key with no expiry never does (isUserKeyExpired)", () => {
    const t = Date.parse(NOW);
    expect(isKeyExpired(NOW, t)).toBe(true);
    expect(isKeyExpired(LATER, t)).toBe(false);
    expect(isKeyExpired(null, t)).toBe(false);
    expect(isKeyExpired("not a time", t)).toBe(false);
  });

  it("hashes with a salt, in the self-describing scrypt format, and verifies only the key", async () => {
    const key = generateKey(seeded(2));
    const a = hashKey(key, seeded(3));
    const b = hashKey(key, seeded(4));
    expect(a.startsWith(`${HASH_PREFIX}16384,8,1$`)).toBe(true);
    expect(a).not.toBe(b);
    expect(await verifyKeyHash(key, a)).toBe(true);
    expect(await verifyKeyHash(key, b)).toBe(true);
    expect(await verifyKeyHash(`${key.slice(0, -1)}A`, a)).toBe(false);
    // A malformed hash is false, never a throw (verifyPasswordHash).
    for (const bad of ["", "$scrypt$", "$scrypt$1,2$x$y", "$bcrypt$x", `${a.slice(0, -4)}`])
      expect(await verifyKeyHash(key, bad)).toBe(false);
  });

  it("accepts only r = 8, p = 1 and a power-of-two N up to 2^16 (review finding E8.12-4)", async () => {
    const key = generateKey(seeded(8));
    const good = hashKey(key, seeded(9));
    const tail = good.slice(good.indexOf("$", HASH_PREFIX.length));
    expect(await verifyKeyHash(key, `${HASH_PREFIX}16384,8,1${tail}`)).toBe(true);
    // Each of these would make verification cost far more, or is not scrypt's.
    for (const params of [
      "16384,8,64",
      "16384,16,1",
      "16384,1,1",
      "131072,8,1",
      "16385,8,1",
      "1,8,1",
    ])
      expect(await verifyKeyHash(key, `${HASH_PREFIX}${params}${tail}`), params).toBe(false);
    // Refused before scrypt runs: p = 64 would cost 64 times a normal check.
    const t0 = performance.now();
    expect(await verifyKeyHash(key, `${HASH_PREFIX}16384,8,64${tail}`)).toBe(false);
    expect(performance.now() - t0).toBeLessThan(250);
  });

  it("verifies off the event loop: the call returns before scrypt runs (E8.12-5)", async () => {
    const key = generateKey(seeded(10));
    const good = hashKey(key, seeded(11));
    // N = 2^16 takes a few hundred milliseconds; on the event loop the call
    // itself would take that long, on the thread pool it returns at once.
    const heavy = `${HASH_PREFIX}65536,8,1${good.slice(good.indexOf("$", HASH_PREFIX.length))}`;
    const t0 = performance.now();
    const pending = verifyKeyHash(`${key.slice(0, -1)}Q`, heavy);
    const elapsed = performance.now() - t0;
    expect(pending).toBeInstanceOf(Promise);
    expect(elapsed).toBeLessThan(50);
    expect(await pending).toBe(false);
  });
});

describe("the key file", () => {
  it("stores the hash and the tail, never the key", async () => {
    const path = await keyFile();
    const { key, record } = createKey(path, {
      actor: dana,
      expires: LATER,
      now: NOW,
      random: seeded(5),
    });
    const text = readFileSync(path, "utf8");
    expect(text).not.toContain(key);
    expect(text).not.toContain(parseKey(key)?.secret ?? "?");
    expect(record.tail).toBe(key.slice(-4));
    expect(listKeys(path, NOW)).toEqual([
      {
        id: record.id,
        key: maskKey(record.id, record.tail),
        actor: dana,
        created: NOW,
        expires: LATER,
        status: "active",
      },
    ]);
  });

  it("refuses an expiry that is not after now, and an actor with no source", async () => {
    const path = await keyFile();
    expect(() => createKey(path, { actor: dana, expires: NOW, now: NOW })).toThrow(KeyFileError);
    const { source: _s, ...noSource } = dana;
    expect(() =>
      createKey(path, { actor: noSource as typeof dana, expires: LATER, now: NOW }),
    ).toThrow();
  });

  it("refuses a file that is not a key file, and a missing one unless allowed", async () => {
    const path = await keyFile();
    expect(() => readKeyFile(path)).toThrow(/no key file/);
    expect(readKeyFile(path, true)).toEqual({ version: 1, keys: [] });
    writeFileSync(path, JSON.stringify({ version: 1, keys: [{ id: "x" }] }));
    expect(() => readKeyFile(path)).toThrow(/not a key file/);
  });
});

describe("the key store a server checks keys with", () => {
  it("accepts an active key and gives its actor", async () => {
    const path = await keyFile();
    const { key, record } = createKey(path, { actor: dana, expires: LATER, now: NOW });
    const store = openKeyStore(path);
    const check = await store.verify(key, NOW);
    expect(check).toEqual({ ok: true, record });
    // A second check takes the remembered digest and still answers the same.
    expect(await store.verify(key, NOW)).toEqual({ ok: true, record });
    expect(store.active(NOW)).toBe(1);
  });

  it("refuses a malformed key, an unknown id, a wrong secret, an expired key", async () => {
    const path = await keyFile();
    const { key } = createKey(path, { actor: dana, expires: LATER, now: NOW });
    const store = openKeyStore(path);
    expect(await store.verify("Bearer nonsense", NOW)).toEqual({
      ok: false,
      reason: "not an Engram API key",
    });
    const other = generateKey(seeded(6));
    expect(await store.verify(other, NOW)).toEqual({ ok: false, reason: "unknown API key" });
    const wrong = `${key.slice(0, -1)}${key.endsWith("A") ? "B" : "A"}`;
    expect(await store.verify(wrong, NOW)).toEqual({ ok: false, reason: "unknown API key" });
    const expired = await store.verify(key, LATER);
    expect(expired.ok).toBe(false);
    expect(expired.ok ? "" : expired.reason).toMatch(/is expired$/);
  });

  it("sees a revocation at the next check, without a restart", async () => {
    const path = await keyFile();
    const { key, record } = createKey(path, { actor: dana, expires: LATER, now: NOW });
    const store = openKeyStore(path);
    expect((await store.verify(key, NOW)).ok).toBe(true);
    revokeKey(path, record.id, NOW);
    const after = await store.verify(key, NOW);
    expect(after).toEqual({ ok: false, reason: `API key ${record.id} is revoked` });
    expect(listKeys(path, NOW)[0]?.status).toBe("revoked");
  });

  it("a remembered digest does not survive the key's hash being replaced", async () => {
    // The cache holds the stored hash it matched: a record rewritten with
    // another hash is checked by scrypt again.
    const path = await keyFile();
    const { key, record } = createKey(path, { actor: dana, expires: LATER, now: NOW });
    const store = openKeyStore(path);
    expect((await store.verify(key, NOW)).ok).toBe(true);
    const other = generateKey(seeded(7));
    const file = readKeyFile(path);
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        keys: file.keys.map((k) => (k.id === record.id ? { ...k, hash: hashKey(other) } : k)),
      }),
    );
    expect(await store.verify(key, NOW)).toEqual({ ok: false, reason: "unknown API key" });
  });
});

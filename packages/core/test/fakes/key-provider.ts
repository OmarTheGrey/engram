// A key provider for tests (card E9.11, ADR 0051): the operator key is 32
// bytes held in memory, wrapping is AES-256-GCM over node:crypto with the
// associated data core passes, and every "random" byte comes from a seeded
// SHA-256 counter, so a test's keys and wrapped bytes are the same on every
// run. Not a provider for real use: its operator key and its randomness are a
// test's, and it is reachable from tests only.
import { createCipheriv, createDecipheriv, createHash } from "node:crypto";
import type { KeyProvider } from "../../src/crypto/keys.ts";

/** A seeded byte source: SHA-256 of the seed and a counter, as many bytes as asked. */
export function seededBytes(seed: string): (n: number) => Uint8Array {
  let counter = 0;
  return (n) => {
    const out = new Uint8Array(n);
    let filled = 0;
    while (filled < n) {
      const block = createHash("sha256").update(`${seed}:${counter++}`).digest();
      out.set(block.subarray(0, Math.min(block.length, n - filled)), filled);
      filled += block.length;
    }
    return out;
  };
}

export interface FakeKeyProviderOptions {
  /** The seed of every byte it draws; default "keys". */
  seed?: string;
  /** The operator key's id; default "kek-1". */
  kek?: string;
  /** Overrides what newDataKey returns, to test core's checks. */
  newDataKey?: () => Uint8Array;
}

/** The provider, and the operator keys it holds by id (a test destroys one by deleting it). */
export function fakeKeyProvider(
  options: FakeKeyProviderOptions = {},
): KeyProvider & { keks: Map<string, Uint8Array> } {
  const bytes = seededBytes(options.seed ?? "keys");
  const kek = options.kek ?? "kek-1";
  const keks = new Map<string, Uint8Array>([[kek, bytes(32)]]);
  return {
    kek,
    alg: "aes-256-gcm",
    keks,
    newDataKey: options.newDataKey ?? (() => bytes(32)),
    wrap(dataKey, aad) {
      const key = keks.get(kek);
      if (!key) throw new Error(`operator key ${kek} is gone`);
      const nonce = bytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, nonce);
      cipher.setAAD(aad);
      const body = Buffer.concat([cipher.update(dataKey), cipher.final()]);
      return new Uint8Array(Buffer.concat([nonce, body, cipher.getAuthTag()]));
    },
    unwrap(wrapped, aad, id) {
      const key = keks.get(id);
      if (!key) throw new Error(`operator key ${id} is gone`);
      if (wrapped.length < 12 + 16) throw new Error("wrapped key is truncated");
      const decipher = createDecipheriv("aes-256-gcm", key, wrapped.subarray(0, 12));
      decipher.setAAD(aad);
      decipher.setAuthTag(wrapped.subarray(wrapped.length - 16));
      return new Uint8Array(
        Buffer.concat([
          decipher.update(wrapped.subarray(12, wrapped.length - 16)),
          decipher.final(),
        ]),
      );
    },
  };
}

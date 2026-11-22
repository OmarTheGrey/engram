// Test helpers for the hash chain (card E1.6): a seeded salt source, so a
// failing run reproduces from its seed, and a fixed Ed25519 key built from a
// constant seed with node:crypto, so checkpoints are signed without drawing
// randomness. Test-only: core takes the keeper and the signer injected.
import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import type { Db } from "../../src/db/db.ts";
import {
  type ChainKeeper,
  chainLink,
  eventRecord,
  leafHash,
  readHead,
} from "../../src/log/chain.ts";
import type { CheckpointSigner, SignatureCheck } from "../../src/log/verify.ts";
import type { MemoryEvent } from "../../src/schema.ts";

/** Salts from a counter under `seed`: deterministic, distinct, 32 bytes each. */
export function seededKeeper(seed: number): ChainKeeper {
  let n = 0;
  return {
    salt: () => createHash("sha256").update(`salt ${seed} ${n++}`).digest(),
  };
}

/** An Ed25519 private key from a 32-byte seed (the PKCS #8 prefix of RFC 8410). */
function keyFromSeed(seed: string) {
  const raw = createHash("sha256").update(seed).digest();
  const der = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), raw]);
  return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

/** A signer and its public key (base64 SPKI DER), from a fixed seed. */
export function fixedSigner(seed = "engram test key"): CheckpointSigner & { publicKey: string } {
  const privateKey = keyFromSeed(seed);
  const publicKey = createPublicKey(privateKey)
    .export({ type: "spki", format: "der" })
    .toString("base64");
  return {
    key: publicKey,
    publicKey,
    sign: (message) => sign(null, message, privateKey).toString("base64"),
  };
}

/** The signature check the CLI injects, here over base64 SPKI keys. */
export const ed25519Check: SignatureCheck = (message, signature, key) => {
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(key, "base64"),
      format: "der",
      type: "spki",
    });
    return verify(null, message, publicKey, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
};

// What a tamperer with database access and the code, but no key, can do
// (the review fix pass's attacks, E1.6-2 to E1.6-5).

/** An event's body as stored. */
export const bodyAt = (db: Db, seq: number) =>
  JSON.parse(
    String(db.prepare("SELECT body FROM events WHERE seq = ?").get(seq)?.body),
  ) as MemoryEvent;

/** Replaces an event's body in place. */
export const setBodyAt = (db: Db, seq: number, event: MemoryEvent) =>
  db.prepare("UPDATE events SET body = ? WHERE seq = ?").run(JSON.stringify(event), seq);

/** Appends a chain entry as the writer does, head row and all. */
export function forgeAppend(
  db: Db,
  kind: string,
  seq: number | null,
  data: string,
  record: string,
) {
  const head = readHead(db) as { size: number; hash: string; seq: number };
  const hash = chainLink(head.hash, leafHash(record));
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

/** Recomputes every chain hash from position `from` on, and the head's hash. */
export function rehash(db: Db, from: number) {
  const rows = db.prepare("SELECT pos, kind, seq, data FROM chain ORDER BY pos").all();
  let prev = String(db.prepare("SELECT hash FROM chain WHERE pos = ?").get(from - 1)?.hash);
  for (const r of rows) {
    const pos = Number(r.pos);
    if (pos < from) continue;
    const record =
      r.kind === "event"
        ? eventRecord(bodyAt(db, Number(r.seq)), JSON.parse(String(r.data)))
        : String(r.data);
    prev = chainLink(prev, leafHash(record));
    db.prepare("UPDATE chain SET hash = ? WHERE pos = ?").run(prev, pos);
  }
  db.prepare("UPDATE chain_head SET hash = ? WHERE id = 0").run(prev);
}

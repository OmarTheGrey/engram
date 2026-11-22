// Test helpers for the hash chain (card E1.6): a seeded salt source, so a
// failing run reproduces from its seed, and a fixed Ed25519 key built from a
// constant seed with node:crypto, so checkpoints are signed without drawing
// randomness. Test-only: core takes the keeper and the signer injected.
import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import type { ChainKeeper } from "../../src/log/chain.ts";
import type { CheckpointSigner, SignatureCheck } from "../../src/log/verify.ts";

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

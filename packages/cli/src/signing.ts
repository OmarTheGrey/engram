// Ed25519 signing of the event log's checkpoints (card E1.6, ADR 0038). The
// key is the operator's: a PEM file they hold, read here and never by core,
// which takes the signer and the signature check injected (log/verify.ts).
//
// The first part is copied from octopus-blackboard
// (https://github.com/octoryn/octopus-blackboard, commit
// 6ddc0fee0cfa161786e8903372cd5ba05ff1f0bc, src/signing.ts), Copyright 2026
// Octoryn, under the Apache License, Version 2.0 (see NOTICE): the key pair
// generator, and signing and verifying text with a PEM key over node:crypto,
// verbatim but for one em dash made a comma (AGENTS.md rule 13) and the
// formatter's line breaks. What follows the copy is ours: the base64 SPKI form the log stores keys in,
// and the signer and check core is given.
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import type { CheckpointSigner, SignatureCheck } from "@engram/core";

// --- copied from octopus-blackboard src/signing.ts ---

/**
 * Minimal session signing (v0). Each session gets an Ed25519 keypair; the
 * private key stays local (never leaves the machine), the public key is
 * recorded on the session. Signing the timeline head hash lets `verify` show
 * whether board state is vouched for by a key, i.e. trusted vs. merely
 * asserted. This is deliberately NOT a full identity/PKI system: no key
 * distribution, revocation, or web-of-trust yet.
 */

export interface SessionKeypair {
  publicKeyPem: string;
  privateKeyPem: string;
}

export function generateSessionKeypair(): SessionKeypair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

/** Sign a hex hash string with a PEM private key; returns base64. */
export function signHash(privateKeyPem: string, hash: string): string {
  const key = createPrivateKey(privateKeyPem);
  return sign(null, Buffer.from(hash), key).toString("base64");
}

/** Verify a base64 signature over a hash against a PEM public key. */
export function verifyHash(publicKeyPem: string, hash: string, signatureB64: string): boolean {
  try {
    const key = createPublicKey(publicKeyPem);
    return verify(null, Buffer.from(hash), key, Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}

// --- end of the copy ---

/**
 * The public key of a PEM key, private or public, as the log stores it:
 * base64 of its SPKI DER, one line. Throws when the PEM is no Ed25519 key.
 */
export function publicKeyText(pem: string): string {
  const key = createPublicKey(pem);
  if (key.asymmetricKeyType !== "ed25519")
    throw new Error(`the key is ${key.asymmetricKeyType}, not Ed25519`);
  return key.export({ type: "spki", format: "der" }).toString("base64");
}

const pemOf = (spki: string) =>
  createPublicKey({ key: Buffer.from(spki, "base64"), format: "der", type: "spki" })
    .export({ type: "spki", format: "pem" })
    .toString();

/** The signer core's checkpoint takes, over the operator's private PEM key. */
export function checkpointSigner(privateKeyPem: string): CheckpointSigner {
  const key = publicKeyText(privateKeyPem);
  createPrivateKey(privateKeyPem); // a public key alone cannot sign
  return {
    key,
    sign: (message) => signHash(privateKeyPem, Buffer.from(message).toString("utf8")),
  };
}

/** The signature check core's verifier takes, over a stored base64 SPKI key. */
export const signatureCheck: SignatureCheck = (message, signature, key) => {
  try {
    return verifyHash(pemOf(key), Buffer.from(message).toString("utf8"), signature);
  } catch {
    return false;
  }
};

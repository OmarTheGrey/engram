// The DSSE envelope (card E9.15): a payload, its type, and signatures over
// the pre-authentication encoding of the two, so a signature over one type of
// payload never verifies as another. Pure: signing and the signature check
// are injected, as for the log's checkpoints (log/verify.ts), so core holds
// no key and calls no crypto but SHA-256 elsewhere.
//
// Ported from DSSE, the Dead Simple Signing Envelope (https://github.com/dsse-lf/dsse,
// moved from secure-systems-lab/dsse, commit 75a79b6ed61c, protocol.md and
// envelope.md), under the Apache License, Version 2.0: PAE as the protocol
// defines it ("DSSEv1", then the byte lengths and the two strings, joined by
// single spaces), the envelope's JSON fields (payload in standard base64,
// payloadType, signatures of keyid and sig), and the verifier's order: parse
// the envelope, check a signature over PAE(payloadType, payload) under a key
// the verifier trusts, and only then read the payload. The keyid is a hint,
// never trusted: a signature counts only when it verifies under the pinned key.
import type { CheckpointSigner, SignatureCheck } from "../log/verify.ts";

/** The payload type of an in-toto Statement (in-toto/attestation, spec/v1/envelope.md). */
export const IN_TOTO_PAYLOAD_TYPE = "application/vnd.in-toto+json";

export interface DsseSignature {
  /** A hint naming the key; here the base64 SPKI public key, as the log stores keys. */
  keyid: string;
  /** The signature over PAE(payloadType, payload), base64. */
  sig: string;
}

export interface Envelope {
  /** The payload's bytes in standard base64. */
  payload: string;
  payloadType: string;
  signatures: DsseSignature[];
}

/** DSSE's pre-authentication encoding: `DSSEv1 <len(type)> <type> <len(body)> <body>`, lengths in bytes. */
export function pae(payloadType: string, body: Uint8Array): Uint8Array {
  const type = Buffer.from(payloadType, "utf8");
  return Buffer.concat([
    Buffer.from(`DSSEv1 ${type.length} `, "utf8"),
    type,
    Buffer.from(` ${body.length} `, "utf8"),
    Buffer.from(body),
  ]);
}

/** An envelope of `body` signed by `signer` over PAE. */
export function signEnvelope(
  payloadType: string,
  body: Uint8Array,
  signer: CheckpointSigner,
): Envelope {
  return {
    payload: Buffer.from(body).toString("base64"),
    payloadType,
    signatures: [{ keyid: signer.key, sig: signer.sign(pae(payloadType, body)) }],
  };
}

/** The envelope as written: its three fields in DSSE's order, two-space indent, one final newline. */
export function envelopeText(e: Envelope): string {
  const ordered = {
    payload: e.payload,
    payloadType: e.payloadType,
    signatures: e.signatures.map((s) => ({ keyid: s.keyid, sig: s.sig })),
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * The bytes of canonical base64, standard or URL-safe (DSSE: a verifier must
 * accept either), padded or not; null for anything else, so a text has one
 * reading.
 */
function base64Bytes(text: string): Buffer | null {
  const url = /[-_]/.test(text);
  if (!(url ? /^[A-Za-z0-9_-]*={0,2}$/ : /^[A-Za-z0-9+/]*={0,2}$/).test(text)) return null;
  const bytes = Buffer.from(text, url ? "base64url" : "base64");
  const again = bytes.toString(url ? "base64url" : "base64").replace(/=+$/, "");
  return again === text.replace(/=+$/, "") ? bytes : null;
}

/** The envelope in `value`, or a sentence on why it is not one. */
export function parseEnvelope(value: unknown): Envelope | string {
  if (!isRecord(value)) return "the envelope is not a JSON object";
  const { payload, payloadType, signatures } = value;
  if (typeof payload !== "string" || base64Bytes(payload) === null)
    return "the envelope's payload is not standard base64";
  if (typeof payloadType !== "string" || payloadType === "")
    return "the envelope has no payloadType";
  if (!Array.isArray(signatures) || signatures.length === 0)
    return "the envelope carries no signature";
  const sigs: DsseSignature[] = [];
  for (const s of signatures) {
    if (!isRecord(s) || typeof s.sig !== "string" || base64Bytes(s.sig) === null)
      return "a signature of the envelope is not a base64 sig";
    sigs.push({ keyid: typeof s.keyid === "string" ? s.keyid : "", sig: s.sig });
  }
  return { payload, payloadType, signatures: sigs };
}

/** The payload's bytes. */
export const payloadBytes = (e: Envelope): Buffer => base64Bytes(e.payload) ?? Buffer.alloc(0);

/**
 * Whether a signature of `e` verifies over PAE under the public key `pin`,
 * whatever keyid it names (DSSE: the keyid is an unauthenticated hint).
 */
export function envelopeSignedBy(e: Envelope, pin: string, check: SignatureCheck): boolean {
  const message = pae(e.payloadType, payloadBytes(e));
  return e.signatures.some((s) => check(message, s.sig, pin));
}

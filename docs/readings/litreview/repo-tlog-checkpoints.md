---
id: repo-tlog-checkpoints
title: "Transparency-log checkpoints: C2SP tlog-checkpoint, Tessera, Trillian, Rekor, sigstore-js"
authors: C2SP; transparency-dev; Google; Sigstore
venue: specification and repositories
year: 2026
tier: new
topics: [provenance, tamper-evidence, merkle, signing]
engram: [govern, plane, H4]
code: https://github.com/transparency-dev/tessera ; https://github.com/google/trillian ; https://github.com/sigstore/rekor ; https://github.com/sigstore/sigstore-js
sources_read: [https://github.com/C2SP/C2SP/blob/main/tlog-checkpoint.md, gh api repository metadata 2026-11-21]
---

## Claim
A log is tamper-evident when a signed checkpoint commits to its size and the RFC 6962 Merkle root, and any later checkpoint must come with a consistency proof from any earlier one.

## Method
The C2SP spec was read. A checkpoint is a signed note with three lines: origin, tree size, and the base64 root hash of the RFC 6962 tree. Ed25519 log signatures sign the note text; cosigners may countersign and must not sign a checkpoint inconsistent with an earlier one.

## Key numbers
- Tessera: Apache-2.0, 262 stars, last push 2026-11-19, Go. Trillian: Apache-2.0, 3,765 stars, last push 2026-11-18. Rekor: Apache-2.0, 1,237 stars, last push 2026-11-20. sigstore-js: Apache-2.0, 188 stars, last push 2026-11-16; npm `@sigstore/sign` 5.1.0, Apache-2.0.

## What Engram borrows
The checkpoint format and RFC 6962 hashing (leaf prefix 0x00, node prefix 0x01; from memory of the RFC, to be checked against it), in a few hundred lines of TypeScript on `node:crypto`, which supports Ed25519. No dependency is needed. The spec's licence was not stated on the page read; implement the algorithm, copy no text.

## What Engram does differently
No server and no public log: a local file of checkpoints and a verifier command.

## Risk to our claims
Offboarding redacts events in place (ADR 0010, `packages/core/src/plane/offboard.ts`), which breaks a naive hash over the event body. The design must commit to a salted hash of the redactable fields and drop the salt on erasure.

## Open question
Where does the signing key live for a local single-user log, and who is the witness?

## Notes
Tessera is the successor design to Trillian; both are Go servers, not libraries for us.

---
id: repo-scitt-dsse-attestation
title: "SCITT (RFC 9943), DSSE and in-toto attestations as audit-evidence envelopes"
authors: IETF SCITT WG; Secure Systems Lab; in-toto
venue: RFC 9943 (June 2026); DSSE spec; in-toto attestation framework
year: 2026
tier: new
topics: [provenance, governance, methods]
engram: [govern, plane]
code: https://github.com/secure-systems-lab/dsse ; https://github.com/in-toto/attestation ; https://github.com/transparency-dev/tessera
sources_read: [https://datatracker.ietf.org/doc/rfc9943/, https://github.com/secure-systems-lab/dsse, https://github.com/in-toto/attestation, https://github.com/transparency-dev/tessera]
---

## Claim
RFC 9943 (Proposed Standard) defines signed statements and transparency-service receipts; DSSE gives a simple signed envelope; in-toto defines typed predicates. Together they are the current standard shape for a tamper-evident, third-party-checkable record.

## Method
RFC listing (via search) and repository metadata read. DSSE: Apache-2.0, about 116 stars, pushed 2026-11-20. in-toto attestation: licence reported NOASSERTION by the API but its LICENSE file is Apache-2.0 (checked 2026-11-21), about 394 stars, pushed 2026-11-16. Tessera (transparency log library, Go): Apache-2.0, about 262 stars, pushed 2026-11-19. The SCRAPI API draft is still a draft.

## Key numbers
None; metadata as returned on 2026-11-21.

## What Engram borrows
A signed audit report as a DSSE envelope with an Engram predicate type (AB-CMP-1), Ed25519 from node:crypto (no dependency), and an optional receipt-shaped checkpoint over a hash chain of events (AB-CMP-2). A full SCITT service or Tessera is not absorbed (Go, a server).

## What Engram does differently
No third-party transparency service: the checkpoint is signed by the deployment's own key, so it proves integrity after the fact, not independence. Say so.

## Risk to our claims
The log is rewritten by erasure (ADR 0010). A naive hash chain over event bytes would break on erasure; the chain must commit to a content-free skeleton (see AB-CMP-2).

## Open question
Should checkpoints be anchored externally (an RFC 3161 timestamp, a git tag) for independence?

## Notes
Whether RFC 9943 defines COSE receipts inline was not fully read.

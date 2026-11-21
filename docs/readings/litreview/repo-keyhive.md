---
id: repo-keyhive
title: Keyhive and Beelay (Ink & Switch), local-first access control with E2EE
authors: Ink & Switch
venue: open-source repository, pre-alpha
year: 2026
tier: new
topics: [twin, store, governance]
engram: [twin, plane]
code: https://github.com/inkandswitch/keyhive
sources_read: [https://www.inkandswitch.com/project/keyhive/, https://automerge.org/docs/keyhive/ark-api-guide/, "gh api inkandswitch/keyhive: Apache-2.0, 280 stars, pushed 2026-11-20, Rust"]
---

## Claim
Capabilities plus group key agreement can give local-first replicas end-to-end encryption where a sync server cannot read payloads and only granted replicas sync.

## Method
Convergent capabilities as a certificate chain (team, user, device, document), BeeKEM tree-based group key agreement, Beelay sync of encrypted payloads, an alpha Automerge Repo integration, and a successor sync layer called Subduction. Keyhive leaves human identity out. Read from search-result summaries of the project pages.

## Key numbers
none stated in the sources read.

## What Engram borrows
Ideas only: grants as certificates with expiry map onto Engram's grant model (ADR 0021); per-document keys suggest per-scope encryption. Code is Rust, pre-alpha and Automerge-bound, so not a dependency.

## What Engram does differently
Engram's grants are decisions in an event log checked by a central plane on the user's machine; there is no multi-replica key agreement.

## Risk to our claims
If Twin later claims multi-device sync, replica-level revocation is an open problem there too.

## Open question
Can Engram's grant event be signed so a grant is verifiable offline?

## Notes
The project describes itself as pre-alpha; do not build on it.

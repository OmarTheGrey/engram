---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0013-adapter-contract-and-conformance.md
  - packages/core/src/plane/write.ts
supersedes: none
---

**What.** A re-keyed record is recognised by the store's own listing, not by the files adapter's folder identity: every unrelated holder of the ref is in the adopted scope and store and absent from the listing.

**Why.** The backlog row proposed retiring a holder whose id is the same file's imported id under an older folder identity. Core cannot compute a files adapter's ids, and a store-specific branch in core is forbidden. A holder the store no longer lists is retired by the adoption's final sweep anyway; this retires it first, in the adopting transaction.

**Result.** No adapter change and no new capability. A holder in another scope, or one the listing still holds (a non-conforming store), still fails closed: `packages/core/test/unit/plane/adopt.test.ts` now seeds its holder in another scope to keep that test.

**Consequence.** Cost if wrong: a store overwriting one record with another's counts as a re-key.

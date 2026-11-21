---
date: 2026-11-21
author: claude-agent
type: finding
card: A5
chapter: discussion
pillar: plane
hypothesis: H3
evidence:
  - packages/adapters/test/plane/revocation.test.ts
  - docs/decisions/0004-provenance-and-source-trust.md
  - docs/decisions/0005-bi-temporal-validity.md
  - docs/decisions/0025-retention-semantics.md
supersedes: docs/log/2026-11-21-a5-finding-rebirth-by-re-edit.md
---

**What.** After a revocation through the plane, a revoked record put back in the store comes back into reads only when it is re-edited at a higher version, and then by design.

**Why.** The Memory-Rebirth-Attack scenario, a revoked fact re-entering the store outside the gate.

**Result.** A restore of the pre-revocation record is denied by the version rule (ADR 0005 D1, enforced by E2.3's D4), nine of nine. A re-edit at version 3 is adopted and admitted on every store. Under ADR 0004's narrowed D8 any record edited in the store is recorded with the adopter as actor and kind `import` at most, and ADR 0025 rule 5 lets an import restate retired content. RV4 blocked rebirth under a new id (`engram/adopt/rekeyed`), not a same-id rewrite at a higher version.

**Consequence.** The boundary is anything that can write the store, attributed to the owner; intended.

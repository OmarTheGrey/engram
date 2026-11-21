---
date: 2026-11-21
author: claude-agent
type: change
card: A5
chapter: evaluation
pillar: plane
hypothesis: H3
evidence:
  - packages/adapters/test/plane/revocation.test.ts
  - "make test-one T=packages/adapters/test/plane/revocation.test.ts"
supersedes: none
---

**What.** Card A5 adds a revocation grid that runs on every store in the conformance registry through `Plane.read`: the nine scenarios of arXiv 2609.08258, three revocation marks (retired, validity window closed, own ttl expired), direct insertion through `Plane.write` and indirect insertion by the store's own means then adoption, two rebirth rows and two pinned gaps.

**Why.** That paper found two stores returning a revoked policy above its replacement in all 81 of its cells; the plane should make that impossible whatever the store does.

**Result.** It passed at once for every recorded mark: 79 of 79 tests, six stores (fake, fake without search, the validity double, Mem0, files, Letta), 19 reads per cell, the replacement first in every scenario read. Removing the read filter's status check fails exactly the retired cells (mutation check).

**Consequence.** A per-store regression guard; the gaps are separate findings.

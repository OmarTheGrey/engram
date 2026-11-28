---
date: 2026-11-28
author: claude-agent
type: change
card: E1.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/chain.ts
  - packages/core/src/log/verify.ts
  - packages/pi-extension/src/extension.ts
  - packages/core/test/unit/log/attestations.test.ts
  - packages/pi-extension/test/chain.test.ts
supersedes: none
---

**What.** The review's fixes: a handle is cached at chain version 2 only when it read version 2, never after appending the version entry itself; the pi extension re-checks for a chain before every Plane call; `chainVersion` returns at once for a version 2 genesis; `attested` counts the entries' digests, so a failed report counts them too; an uncovered attestation row must name the event at its seq.

**Why.** Review findings 1, 2, 5, 6 and 8: a rolled back upgrade left a writer that broke verification; a chain begun mid-session left the agent's writes unchained.

**Result.** New tests: an upgrade rolled back with its caller's transaction is made again (fails with the old cache); a chain another handle begins mid-session verifies clean (fails without the re-check); an uncovered row re-pointed fails. `make test-invariants` 21 passed.

**Consequence.** The audit row was not rerun; none of its mutated lines changed.

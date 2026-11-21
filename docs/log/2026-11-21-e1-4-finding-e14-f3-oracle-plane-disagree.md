---
date: 2026-11-21
author: claude-agent
type: finding
card: E1.4
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/property/stateful.test.ts
  - packages/core/src/oracle.ts
  - "ENGRAM_STATEFUL_RUNS=3000 make test-one T=packages/core/test/property/stateful.test.ts"
supersedes: none
---

**What.** Finding E14-F3: the plane lets the owner grant an item that once held her agent's content, and the oracle counts it a violation, so the twin dogfood report would too.

**Why.** The deep run's first counterexample (3,000 runs, seed -19116893, path "1179:0:2:1:2:2", shrunk five times): `[twin, write(agent, 0), write(dana, 0, grant)]`. Her agent writes a person item (model content, allowed there); Dana rewrites it in her own words with a grant to Sam. A later grant change does the same.

**Result.** The gate allows both (the item's kind is now user) and Sam reads it. `grantChangeProblem` in src/oracle.ts forbids grants on an item that ever held untrusted content, so `dogfoodReport` counts a violation per such event. Plane and oracle disagree. Pinned in the test named `E14-F3`; the main property filters that one message.

**Consequence.** For the lead before the tag: decide which side is right and align the other.

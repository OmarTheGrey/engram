---
date: 2026-11-21
author: claude-agent
type: finding
card: E1.4
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/stateful.test.ts
  - packages/core/test/unit/plane/crash-windows.test.ts
  - "ENGRAM_STATEFUL_STRICT=F1 ENGRAM_STATEFUL_RUNS=2000 make test-one T=packages/core/test/property/stateful.test.ts"
supersedes: docs/log/2026-11-21-e1-4-finding-e14-f1-store-keeps-grant.md
---

**What.** Finding E14-F1, widened: a write or grant change that adds a grant and is killed or failing after its store write leaves the grant in the store's record for good; adoption drops it from the projection only.

**Why.** Review finding E1.4-5: a live store failure after persisting (`store.write:after` raising once) on a grant change does the same as a kill (crash case G4). E1.4-6: the recorded counterexample was out of date.

**Result.** Today `ENGRAM_STATEFUL_STRICT=F1` fails at seed -19116893, path 20:2:6:8:0:0:0:0, replay path BABAEAEABJIAZAD:VVF, shrunk to `[tight, write(dana, new person:dana #0, grant, crash store-after)]`. No reader is let in, and invariant 7 holds; store and projection disagree on grants after recovery. Pinned in tests named E14-F1 and crash cases W2b, G1, G4.

**Consequence.** For the lead: whether adoption, or the owner's next write, should rewrite such a record.

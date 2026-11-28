---
date: 2026-11-28
author: claude-agent
type: failure
card: E2.19
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - packages/core/test/property/approvals.test.ts
supersedes: none
---

**What.** The first run of the new property file passed its properties but failed its own guard: 8 routed landings over 300 runs, against the 20 it requires.

**Why.** Most generated promotions were by unrouted actors, or came after long clock steps had expired the request.

**Result.** The generator draws the routed lead, an unrouted member and the person owner more often, shorter clock steps and reviews three times in four, over 500 runs: 29 routed landings, 11 owner landings, 42 route refusals, 38 self refusals, 30 refusals, 287 expiries, 150 by the final sweep.

**Consequence.** None; the guards stand as written.

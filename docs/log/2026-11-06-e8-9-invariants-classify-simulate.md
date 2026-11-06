---
date: 2026-11-06
author: claude-agent
type: decision
card: E8.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - "ENGRAM_INVARIANTS=1 pnpm --filter core exec vitest run test/property/invariants.test.ts"
supersedes: none
---

**What.** The invariants file's Plane surface check now classifies `simulate`: an outsider simulating a read of the secret's words gets a report without them, and the real log gains no event.

**Why.** The check refuses an unimplemented method that lands unclassified; the testing convention makes any change to the file need a second reviewer and a decision entry.

**Result.** `simulate` left the NotImplementedYet list. The five invariants pass with `ENGRAM_INVARIANTS=1`, in 20.8 s.

**Consequence.** The PR asks the lead for the second review of this file.

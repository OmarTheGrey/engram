---
date: 2026-11-06
author: claude-agent
type: decision
card: none
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/property/oracle.ts
  - "ENGRAM_INVARIANTS=1 pnpm --filter core exec vitest run test/property/invariants.test.ts"
supersedes: none
---

**What.** The invariants file and its oracle now know the kind `external`: it is untrusted and relearning in the oracle, last in its trust order, admitted by the seeding policy, kept in person scope for promotion sources, and drawn in the isolation, relearning and restatement cases.

**Why.** An oracle that did not know the kind would call a correct denial a violation, and a property that never drew it would not test its rules; the testing convention asks a second reviewer and this entry for any change to the file.

**Result.** All five invariants pass with `ENGRAM_INVARIANTS=1`.

**Consequence.** The PR asks the lead for the second review.

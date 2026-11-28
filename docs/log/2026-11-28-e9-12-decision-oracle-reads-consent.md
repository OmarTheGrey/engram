---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.12
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/oracle.ts
  - packages/core/test/property/consent.test.ts
supersedes: none
---

**What.** Added `consentForbids` and `phraseOf` to the lead-owned oracle, written apart from consent.ts: phrases read by padding folded text, content compared by the oracle's `sameContent`.

**Why.** The invariant checks must know the new refusal; the convention requires a decision entry for an oracle change. invariants.test.ts is unchanged: its policies set no consent, so its checks hold as before.

**Result.** The acceptance property judges every Plane decision by `consentForbids`; core and oracle agree on every table case in the unit test.

**Consequence.** A second reviewer should read the oracle hunk. If the lead wants consent inside invariant 2, its draws gain an opt-out; not done here.

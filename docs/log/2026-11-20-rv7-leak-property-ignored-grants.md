---
date: 2026-11-20
author: claude-agent
type: change
card: RV7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/read-leak.test.ts
supersedes: none
---

**What.** The read-leak property now keeps a live grant naming the reader on some hidden items when the policy does not honour grants (core review finding RV-CORE-6). A guard requires such cases in more than a twentieth of the runs.

**Why.** The property stripped every grant naming the reader from hidden items, so the mutant that drops `honour_grants` from `reachable` in `packages/core/src/policy/evaluate.ts` survived.

**Result.** With that mutant applied, the property fails: the hidden item becomes a read candidate and changes the read's filtered count. Without it, the property passes.

**Consequence.** Nothing else. Under honoured grants the property draws as before.

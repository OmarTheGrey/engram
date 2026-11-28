---
date: 2026-11-28
author: claude-agent
type: finding
card: D5
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/plane/promote.ts
  - packages/core/src/plane/revalidate.ts
  - packages/core/test/unit/lint/procedural.test.ts
supersedes: none
---

**What.** Merging card D4, a drift restore (`restoreRetired`, called by `Plane.revalidate`) goes through the same promotion decision, so it meets the safety scan as any admission does.

**Why.** The coordinator's note on the merge: a restore is an admission again, judged as the candidate it was.

**Result.** Tested on the real Plane: under hold, a drift-retired procedure with a critical finding is not restored; its event is one `gate` ask under `engram/promote/safety-scan`, the reason starting with D4's "drift restore of item" clause, and the item stays retired (`revalidate` reports `refused`). A clean procedure is restored as before, its reason saying the scan found nothing.

**Consequence.** `RevalidateOptions` carries no release, so a held restore cannot be released; whether it should is for D4's follow-up or E2.19.

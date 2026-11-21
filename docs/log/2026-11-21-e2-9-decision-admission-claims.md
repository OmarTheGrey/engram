---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/scripts/admission.ts
  - packages/core/src/policy/secrets.ts
supersedes: docs/log/2026-11-21-e2-9-decision-admission-by-growth.md
---

**What.** Admission is as before; its claims are corrected. An admitted rule is timed at n = 4,096 and 4n = 16,384 characters and no further; only a rule over the growth limit is timed again at 16n = 65,536 before it is refused.

**Why.** The superseded entry and the `SCAN_LIMIT` comment said admission covered the 64K limit (V-5). It covers a quarter of it; the limit rests on linear growth seen up to 16,384. The 1 ms floor below which an input is not judged is absolute, so how much is judged depends on the machine's speed.

**Result.** The comment, this entry and PR.md say so. Timing every admitted rule at 16n would roughly triple the five-minute generator run, so it is left out.

**Consequence.** Growth is evidence up to 16,384 characters.

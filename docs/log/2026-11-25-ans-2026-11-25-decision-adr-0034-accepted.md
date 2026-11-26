---
date: 2026-11-25
author: claude-agent
type: decision
card: ANS-2026-11-25
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
  - docs/tasks/lead-decisions.md
  - packages/core/src/policy/promotion.ts
supersedes: none
---

**What.** ADR 0034 (the grant change) is accepted by the lead, on items 34 (a) and 35 (a), with every amendment it carries.

**Why.** The lead wrote "accept the adrs" on 2026-11-25: his own answer, not one under the delegation, option (a) of each item.

**Result.** The text did not match option (a): decision 3 had no maximum expiry, and decision 6 let a first write carry an expired or other-class grant. Both were amended: a one-year expiry cap, a first write held to the whole of `grantDefect`, and a promotion's new version exempt, keeping the owner's grants (admitting nothing across a class change) and carrying none for anyone else. An acceptance note says item 35 is built and item 34 is not.

**Consequence.** The code falls short of decisions 3 and 6 until a core card builds the cap and the first-write rule (finding of the same date).

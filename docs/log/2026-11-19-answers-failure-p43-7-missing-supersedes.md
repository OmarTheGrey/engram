---
date: 2026-11-19
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - docs/log/2026-11-19-orch-decision-two-of-three.md
  - docs/log/2026-11-03-pr4-f2-decision-audit-stop.md
supersedes: none
---

**What.** The two-of-three entry changed the audit-stop decision's "both members' key sheets" to "every member's" without superseding it.

**Why.** It was written as a new rule rather than as a change to PR 4's stop decision.

**Result.** It now supersedes `docs/log/2026-11-03-pr4-f2-decision-audit-stop.md` (edited in place, unmerged); the supersedes check reports 141 links, none superseded twice, every target present.

**Consequence.** The audit-stop chain has one head.

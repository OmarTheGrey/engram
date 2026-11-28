---
date: 2026-11-28
author: claude-agent
type: decision
card: D4
chapter: design
pillar: distill
hypothesis: none
evidence:
  - docs/decisions/0051-drift-revalidates-on-environment-change.md
  - docs/decisions/0011-one-lifecycle-replay-admission.md
supersedes: docs/log/2026-11-28-d4-decision-environment-revalidates.md
---

**What.** The departure from ADR 0011 is now its own proposed ADR, XXXX (numbered at merge), which supersedes only ADR 0011's sentence "a changed environment hash retires them"; ADR 0011's dated D4 amendment is replaced by a one-line pointer.

**Why.** ADR 0011's Consequences say a change to its decision needs a superseding ADR (review finding 1); the orchestrator decided so. The ADR also states the retirement rule (the success floor after min-trials) and that the literature amendment's list of environment assumptions is not built (review finding 2).

**Result.** ADR 0051, status proposed, for the lead's acceptance: re-validate on a changed hash, retire on the floor, an unsmoothed per-re-validation rate, a presented hash, one event per decision, a restore through the promotion gate.

**Consequence.** The lead accepts or rejects ADR 0051; the code follows it either way with no schema change.

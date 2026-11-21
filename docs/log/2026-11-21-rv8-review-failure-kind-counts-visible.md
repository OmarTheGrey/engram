---
date: 2026-11-21
author: claude-agent
type: failure
card: RV8
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - research/results/h2-label-audit-longmemeval.json
  - research/scripts/label_audit_draw.py
supersedes: none
---

**What.** The committed draw records carried `by_kind` counts, and three log entries and the procedure page quoted them (review finding RV8-6).

**Why.** The members read this repository during the audit; a count per kind tells them how many unanswerable questions or attacks to expect, which is the label they must give blind.

**Result.** Both draw results, two measurement entries, one finding and `docs/research/label-audit.md` carried counts. The docstrings of the sampler and the agreement script also said two members, while three audit: Omar, Mohamad and Shady.

**Consequence.** Counts removed everywhere; see the decision entry of this pass.

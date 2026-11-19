---
date: 2026-11-19
author: claude-agent
type: decision
card: L4
chapter: design
pillar: research
hypothesis: H3
evidence:
  - research/scripts/h3_lint_delta.py
supersedes: none
---

**What.** The model-based delta is both tiers minus the deterministic tier, both flagging a label when either does, from the same `Plane.lint` call per state and seed; the model tier alone is reported beside it.

**Why.** H3 reports model lints as a separate tier above the deterministic floor; what they add is what an operator gains by enabling them.

**Result.** The script fails if the deterministic tier differs between seeds, since it calls no model.

**Consequence.** A negative precision delta means the model tier's false findings outweigh its finds.

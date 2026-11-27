---
date: 2026-11-27
author: claude-agent
type: decision
card: H5P
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - docs/research/preregistration.md
  - docs/tasks/H5P.md
supersedes: none
---

**What.** Drift and the safety scan are off in every H5 config; card D5's scan runs once after the run, model-free, and its counts are descriptive.

**Why.** H5 registers admission, not retirement, and cards D4 and D5 assume both are off.

**Result.** No procedure is retired or held during H5. Proposed, card H5P item 9.

**Consequence.** The lead approves, changes or refuses it; nothing is registered until then.

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

**What.** One library per domain is induced once with the config's first seed and used by all three seeds; examples go in task-id order, chunked by whole example when over M1's context.

**Why.** As MEM-INV-Bench's agent note is written once per case and serves all three seeds (Seeds section; decision sheet item 8).

**Result.** 2 to 104 induction calls; the induction's own variance is not measured, a stated limit. Proposed, card H5P item 4.

**Consequence.** The lead approves, changes or refuses it; nothing is registered until then.

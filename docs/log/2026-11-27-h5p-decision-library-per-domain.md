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

**What.** Proposed for the lead: one library per domain, induced once with the config's first seed and used by all three seeds, examples in task-id order, chunked by whole example when over M1's context.

**Why.** As MEM-INV-Bench's agent note is written once per case and serves all three seeds (Seeds section; decision sheet item 8).

**Result.** 2 to 52 induction calls, one per domain at least and one per induction-half task at most (15 plus 37); the induction's own variance is not measured, a stated limit. Card H5P row 4.

**Consequence.** The lead's answer entry on this item supersedes this one; nothing is registered until then.

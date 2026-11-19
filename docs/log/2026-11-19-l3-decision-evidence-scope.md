---
date: 2026-11-19
author: claude-agent
type: decision
card: L3
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/model.ts
  - packages/core/test/property/lint-leak.test.ts
  - docs/decisions/0009-retrieval-explanations.md
supersedes: none
---

**What.** A model finding's evidence names the other item or source, the recorded hash, the model and seed, and the model's reason clipped to 280 characters; when the source is outside the linted scope the reason is withheld.

**Why.** Every member of the scope sees a lint event (ADR 0009, post-merge amendment), and a model's reason may restate the source. As with source-changed, the finding itself is raised, leaking one bit, so the claim's owner can fix it.

**Result.** A property test over generated worlds, with a model quoting all it was sent, finds no visible event carrying an out-of-scope item's content; breaking the rule fails it and a unit test.

**Consequence.** Offboarding's redaction covers these events, since their evidence names the item ids.

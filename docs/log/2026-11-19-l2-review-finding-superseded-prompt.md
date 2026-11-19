---
date: 2026-11-19
author: claude-agent
type: finding
card: L2
chapter: limitations
pillar: research
hypothesis: H3
evidence:
  - packages/core/src/lint/model.ts
  - packages/bench/src/faults/labels.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Superseded recall measures how the model reads card L3's contradiction prompt, not only whether it sees a supersession.

**Why.** The prompt (`LINT_PROMPTS.contradiction`) calls two statements a contradiction when they "cannot both be true at the same time", and sends their text only, not their times. "My gym is X" and a later "These days my gym is Y" can be read as two states at different times, and so as consistent; a conflict, said in the same breath, cannot.

**Result.** The superseded subtype's description, the fixture README and the result's `limits.superseded` say so. A backlog row asks the lead or card L4 to decide whether the prompt should treat a later update of the same attribute as a contradiction; a prompt change would be a new cassette and an amendment. The prompt is unchanged here.

**Consequence.** L4 reports superseded and conflict recall apart.

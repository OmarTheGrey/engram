---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/results/h1-refusal-leaks.json
  - packages/runner/src/run.ts
supersedes: docs/log/2026-11-03-pr4b-decision-refusal-leaks.md
---

**What.** Recommended, for the lead's decision: the 41 refusal-leak checkpoints stay in the primary set, with a sensitivity table without them (decision sheet item 10), restated.

**Why.** the final verification of PR #27 (V-4): the sheet treated the rule scorer as deciding sessions and offered "score with the judge only" as an alternative, which H1's run already does.

**Result.** The runner judges every GateMem row when the config names a judge, and `research/configs/h1-gatemem.json` does, so the judge decides every live session and the rule scorer none. The checkpoints come from the rule scorer's patterns, so the table is a robustness check where the judge's handling of refusals is unmeasured.

**Consequence.** The false alternative is dropped.

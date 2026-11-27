---
date: 2026-11-26
author: claude-agent
type: change
card: X20
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/answer-refusal.test.ts
  - research/tests/test_h1_answer_refused.py
  - research/analysis/h1.py
  - packages/runner/src/research/h1-sessions.ts
supersedes: none
---

**What.** A refused GateMem utility session carries `exclusion: "answer refused"` with a null `utility_ok` into its `h1-sessions/2` row, and the H1 table counts such sessions per condition in its MGS entry as `utility_exclusions`.

**Why.** Review X20-3: the converter gave any excluded utility row a null `utility_ok` with no reason, and h1.py forbade an exclusion on a utility row, so a refusal left U uncounted.

**Result.** h1.py accepts an exclusion on a utility row only with a null `utility_ok`; the key appears only when a session is so excluded, so no committed table moves. A turn-limited utility row keeps no exclusion, card X21's `capped` counts it. `test_h1_answer_refused.py`: 2 pass; h1 secondary, pipeline, evidence and exclusions tests: 32 pass.

**Consequence.** After X21 merges, the coordinator asks for one reconciled per-condition count of utility sessions out of U.

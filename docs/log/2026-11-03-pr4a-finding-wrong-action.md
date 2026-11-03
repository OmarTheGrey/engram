---
date: 2026-11-03
author: claude-agent
type: finding
card: R1
chapter: discussion
pillar: research
hypothesis: H1
evidence:
  - docs/research/preregistration.md
  - packages/bench/src/gatemem/score.ts
  - packages/runner/src/run.ts
supersedes: none
---

**What.** Pre-registration v0.2 words H1's GateMem metric as checkpoints that "leak a target or take the wrong action (A and F)", but GateMem's own A and F count a wrong action only under `--gate_by_action`, which is off by default.

**Why.** Writing the converter needed one definition of a GateMem violation, and the two readings differ.

**Result.** `scorePredictions` and `judgeOne` mark a wrong action as a leak only when `gateByAction` is set; the runner's judge pass promotes the judge's summary with `gated_by_action: false` (`packages/runner/src/run.ts`). So "A and F" as GateMem reports them by default exclude wrong actions. The converter follows GateMem's default and offers the other reading as `make h1-table GATE_BY_ACTION=1`.

**Consequence.** Part B's v1 text and decision sheet choose one reading; the H1 table follows it with no code change.

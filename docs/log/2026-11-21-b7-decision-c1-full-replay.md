---
date: 2026-11-21
author: claude-agent
type: decision
card: B7
chapter: design
pillar: research
hypothesis: H2
evidence:
  - packages/bench/src/merit/config.ts
  - docs/decisions/0031-c1-and-c4-on-each-benchmark.md
supersedes: none
---

**What.** C1 on MERIT is MERIT's own `C1`, FullReplay: no store and no seam, every prior transcript in the prompt (last 60,000 characters).

**Why.** The pre-registration defines C1 as `none; long context only`, and ADR 0031 makes C1 on GateMem that benchmark's long-context agent. MERIT's own `C0` (no memory at all) was the alternative.

**Result.** C1's key names store none and preset none, as the runner's statedPreset does.

**Consequence.** If the lead reads C1 as MERIT's C0, its 25 cassettes are re-recorded under a changed `MERIT_CONDITION_KEY`; nothing else moves.

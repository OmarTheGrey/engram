---
date: 2026-11-19
author: claude-agent
type: decision
card: RV1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-cost.json
  - packages/runner/src/config.ts
  - packages/runner/src/research/h1-sessions.ts
supersedes: docs/log/2026-11-19-rv1-decision-turn-limit-default.md
---

**What.** Proposed for the lead, as before: a turn limit of 8 model calls per session in every experiment config, unset in pipeline configs, and a capped session excluded under its own reason (`turn limit`); with one gap stated.

**Why.** The cost estimate's high case is four calls a session (`research/configs/h1-cost.json`), so 8 bounds the worst session at twice it. Excluding keeps a cut-off answer out of the violation rate.

**Result.** A capped access, forgetting or MEM-INV-Bench session is counted by reason among each condition's exclusions. A capped GateMem utility session is not: h1-sessions/2 allows no `exclusion` on a utility row, so it leaves U with a null `utility_ok` and no count (review RV1-4). If capped sessions differ by condition, U can move unseen.

**Consequence.** The lead sets the value and the rule before the tag, and decides whether the H1 table counts capped utility sessions.

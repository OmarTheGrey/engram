---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/gatemem-reach.ts
  - research/scripts/h1_gatemem_reach.py
  - packages/bench/src/gatemem/vendor/judge_prompt.txt
supersedes: docs/log/2026-11-02-pr2-decision-reachable-definition.md
---

**What.** The reach's headline uses the patterns GateMem scores as a leak (an access checkpoint's not_include and leak targets, a forgetting checkpoint's leak targets); the leak targets alone are reported beside it.

**Why.** H1's metric is GateMem's: the rule-based scorer (`scoreOne`) and the judge prompt both count not_include as a privacy leak, so what C5 can keep out of the model is measured against what H1 will score.

**Result.** Each checkpoint is reachable (a scored pattern in a turn the asker reads), located but unreachable, or not located; the every-pattern share is reported as the bracket's lower end. Cost if wrong: generic not_include patterns ("yes", "no") make the scored set's reach larger than any secret's, which the targets-only columns show.

**Consequence.** None.

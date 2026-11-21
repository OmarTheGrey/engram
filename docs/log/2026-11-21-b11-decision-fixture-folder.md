---
date: 2026-11-21
author: claude-agent
type: decision
card: B11
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - fixtures/tau2/script.json
  - fixtures/tau2/expected-results.jsonl
  - research/configs/b11-tau2-fixture.json
  - "node packages/cli/src/main.ts doctor"
supersedes: docs/log/2026-11-21-b11-decision-fixture-slice-evaluation.md
---

**What.** The tau2 slice's scripted upstream and expected results moved from `fixtures/bench/tau2/` to `fixtures/tau2/`. The slice itself is unchanged: airline test tasks 6, 19 and 16, seed 1, C1, C2 and C5 at preset medium, every task under EvaluationType.ALL. The evidence paths of four earlier B11 entries name the new place; their bodies are unchanged.

**Why.** `engram doctor`'s benchmark-pins check reads every folder under `fixtures/bench/` as a vendored benchmark fixture with a `manifest.json`. These files are inputs written for this card, not vendored data, as B7's MERIT inputs are. Moving them failed 19 doctor tests in the full suite. Doctor is unchanged.

**Result.** Doctor's only non-ok lines are its two skips. The cassettes did not change, since no prompt holds a path.

**Consequence.** None.

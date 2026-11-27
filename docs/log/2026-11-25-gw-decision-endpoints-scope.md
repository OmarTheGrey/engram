---
date: 2026-11-25
author: claude-agent
type: decision
card: R6
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/tasks/R6.md
  - packages/runner/src/model/upstream.ts
  - packages/runner/src/lint-faults.ts
supersedes: none
---

**What.** Card R6 pins the smoke, B1, H1 and H2 configs, pins the two lint configs only if no MANIFEST byte moves, and adds a check that a pin names the model it was chosen for.

**Why.** Pre-tag condition 5 says each live config. The runner schema takes `openrouter_provider`; the lint configs' strict schema does not, and `h3-lint-floor.json` counts one of them. An experiment config names a slot (`prereg/M1`), so without the check a run with another `MODEL=` would send M1's routing to that model, which `allow_fallbacks: false` makes fail.

**Result.** If a lint config cannot be pinned without moving a result, L10 pins it before the pilot, and condition 5 holds at the tag for every config that runs before W17.

**Consequence.** The endpoint list is a keyless public read outside pinned upstream data; if the agent may not make it, the operator does.

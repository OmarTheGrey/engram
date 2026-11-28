---
date: 2026-11-28
author: claude-agent
type: finding
card: E2.14
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - research/scripts/reproduce.py
  - packages/core/test/unit/policy/load-options.test.ts
supersedes: none
---

**What.** Every MANIFEST row but `h2-frontier-axes.json` was rerun through `reproduce.check_row` on this branch, and all 23 regenerated to their recorded sha256.

**Why.** The card's guard: C3 and C4 embed the parsed policy, and every registered result the policy loader reaches must stay byte for byte as it is.

**Result.** 23 of 23 ok, `h1-gatemem-reach.json` (9607555c...) through `h3-lint-nli.json` (22e3c122...), with pinned data copied into `.engram/upstream/`. The first run stopped at its 50-minute timeout during `h2-longmemeval-ttl`; the rest reran after it. `h2-frontier-axes` was not rerun: it reads presets through `loadPreset`, whose output the preset hash test shows unchanged, and no config sets an option. No fixture, cassette or result changed (`git status` clean apart from this card's files).

**Consequence.** The orchestrator's `make test-repro` should show the same; frontier-axes is the one row taken on the hash argument.

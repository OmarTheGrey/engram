---
date: 2026-11-26
author: claude-agent
type: finding
card: E8.15
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - "git diff origin/main --name-status -- research fixtures packages/bench packages/runner packages/model"
  - "ENGRAM_OFFLINE=1 uv run python <scratchpad>/repro_some.py crosswalk injection_screen secret_guard near_duplicate redteam h3_lint_floor (each MANIFEST row's script to a temporary file, its sha256 compared)"
supersedes: none
---

**What.** Merging `cliupgrade` moves no MANIFEST row, fixture or cassette.

**Why.** The pre-registration guard binds until `prereg-v1` and through the H1 runs.

**Result.** The branch changes no file under `research/`, `fixtures/`, `packages/bench`, `packages/runner` or `packages/model`. Every MANIFEST script runs Python or `packages/runner` and `packages/bench` scripts, and none of their `@engram` dependencies imports `packages/cli`, `ui` or `view`. So no row's script can reach a changed file. As a spot check, crosswalk, injection_screen, secret_guard and near_duplicate reran byte for byte. Offline, redteam and h3_lint_floor refused for missing pinned data. h4_power, pure Python, was stopped after 40 minutes.

**Consequence.** Nothing is regenerated.

---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/configs/label-audit.json
  - "make lint"
supersedes: none
---

**What.** The commit that added the audit's `stop_share` wrote it as `0.10` in `research/configs/label-audit.json`, and biome's JSON formatter wants `0.1`, so `make lint` fails on that commit on its own.

**Why.** The config was edited by hand after ruff, mypy and the tests were run, and biome, which formats the JSON configs, was run only on the TypeScript files.

**Result.** The next commit writes `0.1`; `make lint` passes on it, and the value read is the same.

**Consequence.** Run the whole `make lint` before committing a config, not the linter of the language just edited.

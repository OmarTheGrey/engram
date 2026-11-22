---
date: 2026-11-21
author: claude-agent
type: failure
card: D3
chapter: implementation
pillar: distill
hypothesis: H5
evidence:
  - research/configs/d3-validate-fixture.json
supersedes: none
---

**What.** `make lint` failed once: biome wanted the fixture config's seeds array on one line.

**Why.** The config was written by a script with Python's indented JSON.

**Result.** `biome check --write` fixed it; `make lint` then passed (biome, tsc, ruff, mypy).

**Consequence.** Nothing.

---
date: 2026-11-21
author: claude-agent
type: failure
card: D2
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/scripts/skill-spec-golden.py
  - packages/core/test/unit/distill/skill-spec/expected.json
supersedes: none
---

**What.** Biome reformatted the validator's JSON output, so the committed `expected.json` no longer matched the script's bytes.

**Why.** Biome checks every JSON file in the repository, and the golden script writes Python's layout.

**Result.** Running `pnpm exec biome format --write` on the fresh output gives the committed file byte for byte (checked with `cmp`).

**Consequence.** The script's command list ends with that step.

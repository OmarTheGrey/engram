---
date: 2026-11-21
author: claude-agent
type: decision
card: R2
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/pi-extension/src/tag.ts
  - packages/runner/src/config.ts
  - packages/core/src/policy/load.ts
  - docs/research/preregistration.md
supersedes: docs/log/2026-11-21-r2-decision-variant-preset-names.md
---

**What.** A variant runs under a preset name of its own in its config, and its policy keeps the id of the preset it varies (`id: preset.medium`). Each arm's card adds its variant name to the runner, leaving the three registered names and their cache keys unchanged.

**Why.** Every C5 read tag and item tag carries the policy's id (`tagRead`), so a variant with its own id would change every C5 request. Its contrast with C5 would then mix the mechanism with a changed prompt. The runner also accepts only strict, medium and permissive (`RunnerConfig.preset` is `z.enum(PRESETS)`).

**Result.** The section's rules state both points. P2 Part B, P5 and U1 name the confound, and P5 compares decisions without `policy_id`, checking the id separately.

**Consequence.** A variant's events name `preset.medium`. Its identity is the preset name in its config, cache key and rows.

---
date: 2026-11-22
author: claude-agent
type: decision
card: E2.11
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/load.ts
  - packages/runner/src/config.ts
  - packages/server/src/workspace.ts
  - packages/pi-extension/src/tools.ts
supersedes: none
---

**What.** Accepted (the lead's decision on review E2.11-8): `loadPreset` resolves `medium-trust` as well as the three registered presets.

**Why.** Every registered path checks a preset name against `PRESETS` before loading it, so none can reach the new preset.

**Result.** Checked: the runner's config (`z.enum(PRESETS)`), the server's `--policy` lookup, the dogfood report, the bench overhead suite and the runner's research scripts check against `PRESETS`; the pi and MCP `candidate` is a union of strict, medium and permissive. Free strings reach `loadPreset` only in scripts no registered result runs: `packages/bench/scripts/longmemeval-date-facts.ts --preset`, which the reviewer named, and three runner scripts found besides (`c4-walk-lengths.ts`, `compare-c4-verdicts.ts`, `retrieval-floor.ts`, positional argument).

**Consequence.** Those four accept `medium-trust` by name; none feeds a MANIFEST row.

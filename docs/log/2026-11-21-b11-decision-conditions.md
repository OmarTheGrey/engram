---
date: 2026-11-21
author: claude-agent
type: decision
card: B11
chapter: design
pillar: research
hypothesis: H5
evidence:
  - packages/bench/src/tau2/config.ts
  - packages/bench/src/tau2/memory.ts
  - packages/runner/src/config.ts
  - packages/runner/src/conditions.ts
supersedes: none
---

**What.** C1, C2 and C5 follow the runner's CONDITION_TABLE, statedPreset and NO_STORE (packages/runner/src/config.ts) and its ungovernedMemoryTools and ungovernedRead (conditions.ts), restated in config.ts since @engram/bench may not import the runner. C2's memory is a loopback server in the launcher that answers `engram serve`'s two routes over the files adapter with no plane, its read core's `retrieve` cut to the read limit. C5 is `engram serve --store files` at the preset.

**Why.** The card names `engram serve` for the plane; C2 is by definition the store with no plane, which `engram serve` cannot be. One request shape lets the shim reach both with only the URL different.

**Result.** The keys carry preset `none` under C1 and C2 and `medium` under C5, store `none` under C1 and `files` otherwise.

**Consequence.** C2's memory calls an adapter directly, as the runner's C2 tools do (rule 2 governs product paths).

---
date: 2026-11-06
author: claude-agent
type: failure
card: PX3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-package/src/config.ts
  - packages/pi-package/test/unit/config.test.ts
supersedes: none
---

**What.** The first `packageConfig` joined `ENGRAM_ROOT` onto the project folder with `path.join`, so an absolute root became a path inside the project.

**Why.** Found while checking this repository's settings by hand: `join` never treats its second argument as absolute.

**Result.** The root is now `path.resolve(cwd, ENGRAM_ROOT)`, and a unit test keeps an absolute root as given (`packages/pi-package/test/unit/config.test.ts`).

**Consequence.** Nothing further.

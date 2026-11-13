---
date: 2026-11-13
author: claude-agent
type: failure
card: PX3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-package/test/install.test.ts
  - pnpm exec vitest run packages/pi-package/test/install.test.ts
supersedes: none
---

**What.** The card's acceptance test failed on the reviewer's machine: `pi install --local` exited 1 with "Project is not trusted. Use --approve to modify local package config.", then the settings check failed.

**Why.** Pi asks for project trust when the folder or any ancestor holds protected resources, and the temp project sits under a home with `.agents/skills`. Second, pi resolves a relative package source from the settings file's folder (`.pi/`), but the test resolved it from the project, which only held when pi wrote an absolute path (temp folder and checkout on different drives).

**Result.** The acceptance test itself was wrong, so it was changed: `--approve` on install (the RPC run already passed its alias `-a`), and sources resolved from `.pi/`. 3 of 3 pass.

**Consequence.** Nothing further.

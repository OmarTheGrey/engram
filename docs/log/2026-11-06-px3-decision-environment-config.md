---
date: 2026-11-06
author: shady
type: decision
card: PX3
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/pi-package/src/config.ts
  - packages/pi-package/src/extension.ts
supersedes: none
---

**What.** The package's extension opens its workspace through `openWorkspace` of `@engram/server` and reads its settings from `ENGRAM_ROOT`, `ENGRAM_STORE`, `ENGRAM_POLICY`, `ENGRAM_DB_URL`, `ENGRAM_OWNER`, `ENGRAM_AS` and `ENGRAM_MEMBER`.

**Why.** A pi package takes no flags. Reusing the CLI's opener keeps one policy, store and log loader, and the variables mirror the CLI's flags.

**Result.** Defaults: a files store at `.engram/memory` in the project, the log at `<home>/.engram/engram.db`, the actor `person:<login>` in its own scope. `packages/pi-package/test/unit/config.test.ts` covers defaults, overrides, an absolute root and a bad scope.

**Consequence.** A pi settings block for Engram, if pi adds package options, would replace the variables.

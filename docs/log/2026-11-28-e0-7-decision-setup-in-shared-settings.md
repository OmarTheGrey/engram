---
date: 2026-11-28
author: claude-agent
type: decision
card: E0.7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - vitest.shared.ts
  - scripts/test/offline-guard.setup.ts
supersedes: none
---

**What.** The setup file is added to the object `vitest.shared.ts` exports (still named `timeouts`), as an absolute path, rather than to each project's config.

**Why.** Every project's config already spreads that object, so the guard reaches all sixteen projects and the e2e config with one shared-file edit and none in another package, which the card's file list requires. Renaming the export would touch every config.

**Result.** A wiring test checks every `vitest.config.ts` under `packages/`, `scripts/` and `test/e2e/` spreads the shared settings and sets no setup files of its own, which would replace them.

**Consequence.** A later card may rename the export to `shared`; the wiring test then names it.

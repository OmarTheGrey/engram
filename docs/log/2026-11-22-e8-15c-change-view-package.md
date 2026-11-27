---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/view/src/view.ts
  - packages/view/src/provenance.ts
  - packages/view/test/package.test.ts
  - packages/cli/test/view-deps.test.ts
  - packages/ui/src/view.ts
  - packages/ui/src/provenance.ts
supersedes: none
---

**What.** The inspector's pure view logic moved, by `git mv`, into a new workspace package `@engram/view` (`packages/view/`), importing only `import type` from `@engram/sdk`; `packages/ui/src/view.ts` and `provenance.ts` are now one-line re-exports with a comment naming this card; the inspector imports `@engram/view`; packages/cli and packages/ui depend on it.

**Why.** Card E8.15c and `docs/design/tui.md` 6.3, decision 4 of section 14: the TUI shows the inspector's views without React.

**Result.** `pnpm exec vitest run packages/view packages/ui packages/cli/test/view-deps.test.ts`: 9 files, 74 tests passed, the inspector's tests unchanged. Both tsc projects pass; `make ui` builds. Mutation: `@xyflow/react` added to `@engram/view`'s dependencies fails `view-deps.test.ts` (it finds `@xyflow/react` and `@xyflow/system` in the CLI's graph) and `package.test.ts`.

**Consequence.** The TUI screens of E8.15c import `@engram/view`; a later view function goes there, not into packages/ui.

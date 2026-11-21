---
date: 2026-11-21
author: claude-agent
type: change
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/README.md
  - packages/adapters/README.md
  - packages/pi-extension/README.md
  - packages/pi-package/README.md
  - packages/mcp/README.md
  - packages/cli/README.md
  - packages/server/README.md
  - packages/ui/README.md
  - packages/bench/README.md
  - packages/runner/README.md
  - packages/model/README.md
supersedes: none
---

**What.** Each of the eleven packages under `packages/` gained a README: what it is for, its rules, its main modules, how to use it, how to test it, and what is next.

**Why.** No package had one, so a reader had to open the source to learn what a package holds and which rules bind it.

**Result.** Every module and function named was checked against the package's `src/` and `test/` folders. Core's usage example (a write by `person:alice`, her read, and an empty read by `person:bob`, on the fake store under the medium preset) was run before it was written down and gave allow under `preset.medium/write/person`, one item, and zero items. Each test command is the package's `pnpm --filter <name> exec vitest run`; `@engram/model`'s ran with 35 tests passing.

**Consequence.** A card that adds or moves a module updates its package README in the same PR.

---
date: 2026-11-28
author: claude-agent
type: failure
card: L9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/test/codex-schema.ts
  - "make lint"
supersedes: none
---

**What.** After merging origin/main, `make lint` failed in tsc on `packages/mcp/test/codex-schema.ts`, a file card E8.17 added, with "'Ajv' only refers to a type".

**Why.** The worktree's installed packages predated the merge, which brought E8.17's new dependency; nothing in this card's files was at fault.

**Result.** `pnpm install --frozen-lockfile --prefer-offline`, then `make lint` passed whole (biome, both tsc projects, ruff, mypy).

**Consequence.** After a merge that adds a dependency, install before running the gates.

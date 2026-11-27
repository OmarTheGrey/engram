---
date: 2026-11-27
author: claude-agent
type: failure
card: E2.21
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - make lint
  - packages/pi-extension/test/surface.test.ts
supersedes: none
---

**What.** `make lint` failed twice after merging origin/main into the branch.

**Why.** Logged like successes (AGENTS.md rule 14).

**Result.** First, biome: "packages\pi-extension\test\surface.test.ts format ... Found 1 error". The paused WIP commit had left that test file unformatted. `biome check --write` fixed it, and the test still passes, 2 of 2. Second, tsc: "Cannot find module '@earendil-works/pi-tui'", "'@engram/view'" and "'@xterm/headless'" in `packages/cli`. Main had added these with the terminal interface, and this worktree's `node_modules` predated them. `pnpm install --frozen-lockfile --prefer-offline` installed them from the lockfile, with no lockfile change. Then `make lint` passed: biome "No fixes applied", ruff "All checks passed!", mypy "Success: no issues found in 82 source files".

**Consequence.** After a merge that adds packages, install before linting.

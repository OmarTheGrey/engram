---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/frames-surfaces.test.ts
supersedes: none
---

**What.** `pnpm exec vitest run -u packages/cli/test/tui/frames-surfaces.test.ts`, meant to refresh that file's frame goldens, ran the whole workspace's suite instead (6,990 tests, 3 failed), which the brief asks agents not to do on the shared machine.

**Why.** Not established: the same command without `-u` ran the one file. Under load the run took several minutes.

**Result.** It updated only the intended goldens: `git status` showed no snapshot or file changed outside `packages/cli/test/tui/__frames__/`. The three failures were not printed by the filtered output; the CLI package's own tests were rerun alone to find them.

**Consequence.** Goldens are refreshed one file at a time with `-t` or through `make test-one`, never `-u` with a path alone.

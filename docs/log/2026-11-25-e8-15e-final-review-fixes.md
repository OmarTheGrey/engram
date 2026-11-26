---
date: 2026-11-25
author: claude-agent
type: change
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/actor-switch.test.ts
  - packages/cli/test/tui/line.test.ts
  - packages/cli/test/tui/final-review.test.ts
  - packages/cli/test/tui/no-policy.test.ts
  - "ENGRAM_OFFLINE=1 ENGRAM_PG=skip pnpm exec vitest run packages/cli/test/tui packages/cli/test/registry.test.ts packages/cli/test/commands.test.ts"
supersedes: none
---

**What.** The final TUI review's F-1 to F-8 are fixed, each pinned by a test that failed first.

**Why.** The palette's rerun ran as the previous actor (F-3), and line mode hid the CLI's own exit-2 refusals as its own (F-7). Others: unpinned parts of R-1 and R-3, wrong text, Forget under --no-saved, a guard skipping packages/view.

**Result.** The palette reruns through rerunArgv. Line mode sends every check refusal through run, and still opens no store a write may create. The guard accepts a decision field copied into a field of the same name or a labelled row; it pins findInReasons by name. All 19 mutants were killed: F-3 2, F-7 3, F-1 and F-2 4, F-4 to F-6 6, F-8 4. App.forget's guard first survived; a direct test now kills it. make lint and make lint-docs passed.

**Consequence.** Line mode prints the plain command's output for every refused line.

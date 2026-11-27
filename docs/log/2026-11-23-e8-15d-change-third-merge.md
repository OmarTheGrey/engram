---
date: 2026-11-23
author: claude-agent
type: change
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/surface.ts
  - packages/cli/test/tui/rerun.test.ts
  - packages/cli/test/tui/no-policy.test.ts
supersedes: none
---

**What.** `origin/cliupgrade` at 12b57e65, E8.15c's last pass, merged into `cliupgrade-d`; after a change of actor, the command row of E8.15d's screens shows what `r` will run.

**Why.** The coordinator's instruction. On the merged tree one test failed: E8.15c's `rerun.test.ts` opens Lint, now E8.15d's screen, and checks that the result's command row is the line `r` runs. Mine showed the form as it stood, whose workspace flags follow the workspace, so the order of `--root` and `--import-valid-from` differed from the rerun line.

**Result.** With another actor's answer on screen, the row is `rerunArgv` of the line that ran, as `r` runs it; otherwise the form. No line of mine was flagged by the stricter guard, and no frame moved. The merge had no textual conflict. 500 of 500 TUI tests pass.

**Consequence.** Nothing further.

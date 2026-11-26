---
date: 2026-11-26
author: claude-agent
type: change
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/no-policy.test.ts
  - packages/cli/test/tui/screens.test.ts
  - packages/cli/test/tui/line.test.ts
  - packages/view/src/view.ts
  - packages/ui/src/detail.ts
  - "ENGRAM_OFFLINE=1 ENGRAM_PG=skip pnpm exec vitest run packages/cli/test/tui packages/view packages/ui packages/cli/test/view-deps.test.ts"
supersedes: none
---

**What.** The fix pass's verification found seven bypasses of the no-policy guard (N-1, B1 to B7), an unchecked `--work` folder (N-2) and an unpinned log-check strip. All are fixed.

**Why.** Labelled rows were allowed wherever they stood, and `findInReasons` was pinned only by a count.

**Result.** Views no longer hold a decision field in a row: `eventFields` replaced `eventDetail`, and each screen draws the two decision fields by name. The guard follows decision text through literals, `new`, mapping callbacks, function results and local copies. It fails a carrier whose type is lost, and pins `findInReasons` by its exact text. Every bypass and the fix pass's mutants run as probes and fail. `workFolder` and `logCheckEnv` each kill two mutants. 677 tests passed, `make lint` passed, and the 28 screens are byte-identical.

**Consequence.** Decision text kept on screen is either named or drawn where it is read.

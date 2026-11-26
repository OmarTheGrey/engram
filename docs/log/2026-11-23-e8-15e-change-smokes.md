---
date: 2026-11-23
author: claude-agent
type: change
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - test/e2e/tui.e2e.test.ts
  - packages/cli/test/tui/pty.ts
  - "ENGRAM_OFFLINE=1 pnpm exec vitest run --config test/e2e/vitest.config.ts test/e2e/tui.e2e.test.ts"
supersedes: none
---

**What.** make test-e2e gains five smokes of engram tui under a real pseudoconsole: Home, a move, a run and quit with the summary; Serve, esc and q while the server runs; line mode; L from Home; screen from line mode. Each checks exit 0 and an exit hook's record of uncaught errors.

**Why.** Card E8.15e: the FakeTerminal cannot show a real console's exit, streams or input modes.

**Result.** Five of five pass on ConPTY in about 30 s; a probe that spawns a child under the pty first skips the file, printing why, where no pseudoconsole can be had.

**Consequence.** Pins q on setImmediate (mutant killed); see the failure entry on the two mutants it cannot kill.

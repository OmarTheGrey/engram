---
date: 2026-11-25
author: claude-agent
type: change
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/main.ts
  - packages/cli/src/tui/line.ts
  - packages/cli/test/tui/line.test.ts
  - packages/cli/test/tui/access.test.ts
  - test/e2e/tui.e2e.test.ts
  - packages/cli/test/tui/pty.ts
supersedes: none
---

**What.** E8.15e's review fix pass. E-1: L hands on the workspace as it acts, a reviewer handoff included; line mode names its actor. E-2: a line of only ctrl+Z or ctrl+D ends line mode. E-3: a refused command line prints the plain CLI's own lines and records exit 2. E-4: quit and exit leave from any question. E-5: tests for the screen given back and the OSC 11 guard. E-6: smokes kill their process trees. E-7: documents corrected. E-8: screen in L's child returns to the parent.

**Why.** Two important and six minor findings of the independent review.

**Result.** Tests first, ten in line.test.ts and three in access.test.ts, two smokes. Four mutants (no preserveScreen, no guard, savable for L, no end-of-input check) each fail a test. A smoke failed on purpose left no node process and no bound port.

**Consequence.** None.

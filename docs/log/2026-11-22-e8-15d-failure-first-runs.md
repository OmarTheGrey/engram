---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/flows-surfaces.test.ts
  - packages/cli/test/tui/parity.test.ts
  - "make test-one T=packages/cli/test/tui/flows-surfaces.test.ts"
supersedes: none
---

**What.** The first runs of the new tests failed: 8 of 12 flows, then 4 of 29 parity cases.

**Why.** Real faults: a server stopped by quitting was recorded twice; the focused row could sit under the "more lines" marker, out of sight; the label column took the shortest label, not the longest; a run left the focus in its text field, so v and J typed there. Test faults: dialog text wrapped across lines, the wrong tab count, the fold left closed, parity samples without `--root` (the CLI itself refuses them: "the files store needs --root"), and key ids not normalised.

**Result.** Each fixed in code or test; all pass.

**Consequence.** Nothing further.

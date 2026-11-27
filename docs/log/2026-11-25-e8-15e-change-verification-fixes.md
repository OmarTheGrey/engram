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
  - packages/cli/src/tui/validate.ts
  - packages/cli/src/tui/app.ts
  - packages/cli/test/tui/line.test.ts
  - packages/cli/test/tui/access.test.ts
supersedes: none
---

**What.** E8.15e's verification fix pass. R-1: L passes the workspace's own flags and the reviewer handoff apart; line mode holds the handoff for this session only and hands it back; the full screen takes it up again. R-2: the checks open no store for a command that changes state and names a store folder. R-3: L's child says hello with a random token and hands back only after its parent answers. R-4: the help names where quit and exit cannot be values.

**Why.** Two important and three minor findings of the verification of the review fixes.

**Result.** Tests first: eight in line.test.ts, two in access.test.ts. Six mutants each fail a test; the token mutant survived until a test sent another answer, then failed it. One commit's test did not parse and was fixed by the next.

**Consequence.** None.

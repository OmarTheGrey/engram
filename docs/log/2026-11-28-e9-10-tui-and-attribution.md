---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.10
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/home.ts
  - packages/core/src/discover.ts
supersedes: none
---

**What.** On Home, discover is `Harness memory`, letter `D`, group Machine. In the table, `AGENTS.md` is attributed to Codex, though pi and other harnesses read it, and Cursor has no home row: its user rules live in its settings, not a file.

**Why.** The card names Codex's AGENTS.md; one harness per file keeps the counts additive. The title `Harness memory outside the plane` was cut in the help overlay's column (see the failure entry).

**Result.** `packages/cli/test/tui/keys.test.ts` holds every letter unique and unreserved.

**Consequence.** If wrong: AGENTS.md counts under one harness only. Cost: a relabel.

---
date: 2026-11-28
author: claude-agent
type: decision
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/E8.16.md
  - docs/tasks/E2.17.md
  - docs/tasks/E2.19.md
  - docs/tasks/E2.15.md
supersedes: none
---

**What.** The card-status pass changes status lines only; four "Depends on" lines that still call a merged card "(in flight)" are left as written.

**Why.** E8.16 and E2.17 name RD1, E2.19 names E9.9, and E2.15 names E2.21 and its branch `e2-14-grant-cap`. Each is a dependency line, not a status line, and the pass was scoped to status lines. Another reader could rewrite them in the same pass.

**Result.** The roadmap says the status lines are current and names the four dependency lines.

**Consequence.** Each is rewritten when its card is worked.

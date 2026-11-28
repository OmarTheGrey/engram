---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.15
chapter: design
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/audit/report.ts
  - packages/core/src/visible.ts
supersedes: none
---

**What.** A report without `--as` is the operator's statement of the whole log; with `--as`, it counts only the events `eventVisibleTo` shows that viewer, names it by level and memberships per level only, and leaves the oracle out.

**Why.** RD1: an answer never shows a viewer what they may not read. The statement holds no field visible.ts narrows (content, ids, actors, scopes, grants, reasons, lineage), so the only exposure is a count, and the operator holding the database already sees every count through `engram log verify`. A viewer's report narrows counts too; the oracle judges every event, so a viewer gets none.

**Result.** Tested: the team viewer's report counts 1 of 5 events and verifies only as that viewer.

**Consequence.** If wrong, the whole-log report gives an auditor counts of events in scopes they cannot read; the fix is to require `--as`, one line in the CLI.

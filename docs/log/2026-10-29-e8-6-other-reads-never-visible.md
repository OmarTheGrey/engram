---
date: 2026-10-29
author: claude-agent
type: finding
card: E8.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/visible.ts
  - packages/ui/src/view.ts
  - packages/ui/test/data.test.ts
  - test/e2e/inspector.e2e.test.ts
supersedes: none
---

**What.** No timeline ever lists another actor's read: a read event names no scope, and `visibleEvents` shows an event without a scope only to its maker.

**Why.** Decision 5 asks the explain view to show another actor's read with the line that only its reader may explain it; this finding says when that can happen.

**Result.** The view meets another actor's read only when the viewer changes while a read is selected (the selection is kept). It then shows the event and the line without calling explain; a 403 from the server (an event whose actor field claims the viewer) renders the same. Both are tested: `packages/ui/test/data.test.ts` and the last two steps of `test/e2e/inspector.e2e.test.ts`.

**Consequence.** If the lead wants an auditor to see other people's reads, `visibleEvents` needs a rule for reads (for example an org-level auditor), which is a decision, not a UI change.

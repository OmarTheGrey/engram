---
date: 2026-11-21
author: claude-agent
type: failure
card: E8.11
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/ui/src/EventTable.tsx
  - packages/ui/src/ItemPage.tsx
supersedes: none
---

**What.** Three tooling slips on the way: Python edits wrote CRLF line ends, a Python string turned an escaped newline into a real one inside diff.ts, and biome refused two a11y patterns.

**Why.** Editing through heredoc Python on Windows, and biome's rules on aria-hidden table rows and labels around a helper's select.

**Result.** Line ends restored to LF before commit; the newline fixed by hand; spacer rows lost their aria attributes and the selects moved inside their labels. Also, an API timeout cut the session once; the work resumed from the committed tests.

**Consequence.** Edits go through files run with `python -I`, or the Edit tool.

---
date: 2026-11-27
author: claude-agent
type: finding
card: RD1
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/read.ts
  - docs/log/2026-11-25-rd1-decision-grants-used-renumbered.md
supersedes: none
---

**What.** Explanations stored before this card merges keep the stored place of each grant: `explain` on an older read in an existing log can still return `grants[1]:person:eve` to eve (review finding 7).

**Why.** `grants_used` is renumbered when a read stores its explanations (`plane/read.ts`), so only reads made after the merge carry the shown numbering. Renumbering in `storedExplanations` on return would need the item as it stood at that read, and a grant change since would renumber a past answer differently from what the reader was given.

**Result.** Not changed. The leak is the index alone, only to the reader that made the read (explain is maker-only), and only for logs written before the merge: the team's dogfood logs.

**Consequence.** If the lead wants it closed, a follow-up renumbers on return against the read's own time; nothing registered reads `grants_used`.

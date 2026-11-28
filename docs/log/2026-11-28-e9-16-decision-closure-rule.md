---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.16
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/portable.ts
  - packages/core/src/visible.ts
supersedes: none
---

**What.** A derived item is one whose lineage names a bundle row or a derived item, transitively; it is named when `idShownTo` (ADR 0047's by-id rule, as a lineage pointer is shown) lets the subject ask for it, and otherwise only counted, with no scope, class or time.

**Why.** The card says ids where the person may see them, a count otherwise; the plane already has one rule for when an id may be shown, and a second would drift from it.

**Result.** In the core fixture two derived items are named and two counted, one of them two steps away.

**Consequence.** An item restating the person's content without lineage is not found; the limits cell of C52 says so.

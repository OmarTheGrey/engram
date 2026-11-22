---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.11
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/ui/src/App.tsx
  - packages/ui/src/EventTable.tsx
supersedes: none
---

**What.** The event table replaces the workspace timeline instead of appearing only on the item page.

**Why.** The card's step 2 says every event the viewer may see, which is the workspace timeline; the item page shows the events naming its item.

**Result.** One component, two places, test ids prefixed `item-` on the item page. The existing tests found every row they look for, since the fixtures fit in the rendered window.

**Consequence.** If wrong, a test that waits for a row far below the view of a long log needs to scroll first.

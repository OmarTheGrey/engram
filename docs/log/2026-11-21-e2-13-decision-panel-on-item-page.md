---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/ui/src/ItemPage.tsx
  - packages/ui/src/WhoCanRead.tsx
  - test/e2e/who-can-read.e2e.test.ts
supersedes: none
---

**What.** The panel lives on E8.11's item page (`#/item/<id>`), in its own file, and asks the server only when the viewer presses its button. It is shown for any id, so a viewer who may not see the item gets the plane's refusal.

**Why.** The card names the item page. On the branch's base there was none, so the panel first sat on each lane card; E8.11 merged an item page before this card finished, and the merge of 85f9d3e5 moved the panel there and left the lane cards as E8.11 made them.

**Result.** The e2e case passes as the owner, the grantee and an outsider; E8.11's item-page e2e still passes.

**Consequence.** The item page, built only from data already fetched, now makes one more call; ItemPage.tsx's header says so.

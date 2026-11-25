---
date: 2026-11-25
author: claude-agent
type: finding
card: RD1
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/write.ts
  - packages/pi-extension/src/extension.ts
  - packages/core/src/policy/grants.ts
supersedes: none
---

**What.** Four disclosures this card leaves for the lead. One: an adoption that drops a hand-added grant names the dropped grantee in its event's reason, which scope members see. Two: `Plane.write` returns the item as stored, unchanged; it is the writer's own submission. Three: the pi extension mirrors the raw log slice of each call into the session. Four: a grant-change refusal names the owner (E2.13's second finding).

**Why.** None is a read answer. Retention events carry no item state, so they need nothing.

**Result.** Not changed.

**Consequence.** A follow-up card may extend `disclosedReason` to the adoption note.

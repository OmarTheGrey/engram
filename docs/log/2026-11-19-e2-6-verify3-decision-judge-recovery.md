---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - packages/core/src/oracle.ts
supersedes: docs/log/2026-11-19-e2-6-verify-decision-oracle-withdrawal.md
---

**What.** The dogfood report judges every allowed withdrawal and narrowing, and a narrowing must remove at least one grant and change nothing else.

**Why.** A recovery event that does not change the grants can still change content, and only these rules can tell.

**Result.** Q3's four planted events each count one violation; the real recovery events in the other tests count none.

**Consequence.** None.

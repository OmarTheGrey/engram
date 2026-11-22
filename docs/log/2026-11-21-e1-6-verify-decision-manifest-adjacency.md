---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/verify.ts
  - packages/core/test/unit/log/attacks.test.ts
supersedes: none
---

**What.** Under the lead's decision on verification finding E1.6-12, a manifest's erase events must be exactly the entries chained just before it, and each erase event may be named by one manifest only.

**Why.** Offboarding appends its erase events and then its manifest in one transaction, so nothing legitimate sits between them; without the rule a forger reused a real erase event to cover lint evidence they blanked.

**Result.** The forged lint redaction, a duplicate of a real manifest, and an erase event named by a second manifest each give FAILED at links; the routine checkpoint refuses the first. A forger must now append a fresh, visible erase event.

**Consequence.** The rule is the writer's own order; a later change to offboarding's transaction must keep it.

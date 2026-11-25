---
date: 2026-11-25
author: claude-agent
type: decision
card: E2.21
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/tasks/E2.21.md
  - docs/log/2026-11-25-e2-21-finding-cap-moves-gatemem.md
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
supersedes: none
---

**What.** The card is split: byte-neutral tests now; ADR 0034's one-year cap and first-write rule after H1's registered runs, behind a policy option absent by default.

**Why.** Built as a default, the cap refuses every GateMem turn write carrying the `OPEN_END` grant and moves `h1-gatemem-reach.json`; the guard forbids that before `prereg-v1`. Decided by the orchestrator under the lead's delegation.

**Result.** Part 2's details, fixed in the card: one year is 365 days (31,536,000 seconds) from the write's event time, the injected clock; a longer expiry is refused, not clamped, under `engram/write/grant-expiry-cap`, its reason naming the limit; it judges every grant a write lands, first write or grant-changing rewrite; a promotion's new version is exempt. The option comes in the second absorb plan's schema PR, E2.14.

**Consequence.** Until part 2, the code falls short of decisions 3 and 6. Making the cap default, and clamping `OPEN_END`, are the lead's.

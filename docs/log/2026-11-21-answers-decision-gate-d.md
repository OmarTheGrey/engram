---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: H4
evidence:
  - docs/tasks/lead-decisions.md
  - docs/decisions/0035-store-independence-is-a-design-property.md
  - docs/decisions/0036-cassettes-beyond-the-repository.md
  - docs/research/preregistration.md
  - docs/roadmap.md
  - packages/bench/PINS.md
supersedes: none
---

**What.** The Gate D answers of 2026-11-20 (lead-decisions items 20 to 33) are carried into v1's H2, H4 and H5, the roadmap's Gate D, PINS.md and the backlog.

**Why.** ADR 0035 names the answers card as where H4 and Gate D change.

**Result.** H4 tests C5's violation rate across M1 to M3 on GateMem only; store independence is a proven design property; the harness claim is untested and C7's test dropped (20, 24, 25). MemoryAgentBench stays pinned and unused. H2's violations come from GateMem's A and F, with its sizes on M1 (22). Gate D reads "two stores" as the request-identity check, names the Knowledge dogfood's card and measures zero violations on the plane (20, 28, 33). Item 21's axis and items 26 and 30's drafts stay with the lead; items 27 and 29 are ADR 0036's.

**Consequence.** B9 needs rescoping; the request-identity check and the Knowledge dogfood need cards.

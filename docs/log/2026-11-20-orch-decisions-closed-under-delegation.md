---
date: 2026-11-20
author: claude-orchestrator
type: decision
card: none
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/tasks/lead-decisions.md
  - docs/decisions/0035-store-independence-is-a-design-property.md
  - docs/decisions/0036-cassettes-beyond-the-repository.md
supersedes: none
---

**What.** The lead delegated the open decisions. The orchestrating session answered 47 of the 48 items in `docs/tasks/lead-decisions.md`, and the choices left open by cards RV4, RV6 and RV7. Item 1, the three models, goes back to the lead. ADR 0035 records items 20 and 24 (store independence, H4 on GateMem). ADR 0036 records items 27 and 29 (the cassette deposit and proxy).

**Why.** Only item 1 moves the programme's cost by up to six times. Card RV8's cost table showed items 2 and 47 change the total by under 3% and 4%.

**Result.** 46 items take option (a). Item 47 takes (c), as registered. Item 31 adds RV7's merge as a condition. Each answer carries its reason.

**Consequence.** An answers card carries the answers into the pre-registration, the ADRs and the roadmap. The lead may overturn any.

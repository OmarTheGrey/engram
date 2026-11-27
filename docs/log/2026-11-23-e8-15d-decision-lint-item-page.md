---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15d
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/policy.ts
  - packages/cli/test/tui/flows-surfaces.test.ts
supersedes: docs/log/2026-11-22-e8-15d-decision-deviations-kept.md
---

**What.** With E8.15c merged, enter on a lint finding opens the finding's item page and space unfolds its evidence; the other two departures of the earlier entry stay: Doctor's checks appear together when it ends, and Simulate is one column at every width.

**Why.** docs/design/tui.md 8.10 says enter opens the item page; the earlier entry kept evidence on enter only because the page was not on this branch.

**Result.** The lint flow presses space for the evidence and enter for the page, and checks the page names the finding's item.

**Consequence.** A finding's item page is a read by id, which asks first where the registry says so.

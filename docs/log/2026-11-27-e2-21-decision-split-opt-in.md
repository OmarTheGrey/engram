---
date: 2026-11-27
author: claude-agent
type: decision
card: E2.21
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/tasks/E2.21.md
  - docs/log/2026-11-25-ans-2026-11-25-decision-grant-cap-opt-in.md
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
  - docs/tasks/backlog.md
supersedes: docs/log/2026-11-25-e2-21-decision-split-after-h1.md
---

**What.** The card stays split: byte-neutral tests now; ADR 0034's one-year cap and first-write rule after H1's `MERGE=4`, behind the policy option `grants.expiry_cap`, absent by default.

**Why.** As a default the cap refuses GateMem's `OPEN_END` turn writes and moves `h1-gatemem-reach.json`. The opt-in is now the lead's own answer (`docs/log/2026-11-25-ans-2026-11-25-decision-grant-cap-opt-in.md`, ADR 0034's acceptance note), closing the earlier finding's "the lead decides".

**Result.** Part 2: 365 days from the event time; longer refused, not clamped, under `engram/write/grant-expiry-cap`, its reason naming the limit and the grant's expiry; every grant a first write, a grant-changing rewrite or a `Plane.changeGrants` addition lands; kept grants not judged again; a promotion's new version exempt; the option set in `twin.yaml` and `knowledge.yaml` only.
**Consequence.** After part 2 the rule holds only where `grants.expiry_cap` is set; the registered presets still fall short of decisions 3 and 6.

---
date: 2026-11-06
author: shady
type: decision
card: L1
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/lint.ts
  - docs/decisions/0008-two-tier-lints.md
supersedes: none
---

**What.** Each lint finding is one `lint` event with decision allow, the finding's item as item_id, the scope as scope_to, policy_id `<policy>/lint/<lint id>`, and a reason of the form `<lint id> (<severity>): <message>; evidence: <items>`. The finding's id is its event's id.

**Why.** ADR 0008 (a) wants lint_id, severity and evidence on the event, but MemoryEvent has no such fields, and a schema change is its own PR (AGENTS.md rule 5). The reason and policy id carry all three without one.

**Result.** applyEvent ignores op lint, so the replay test shows the projection unchanged and rebuilt the same (packages/core/test/replay/lint.test.ts). Running the lint again appends the same findings again; nothing is deduplicated.

**Consequence.** A later schema PR can add the fields; until then readers parse the reason.

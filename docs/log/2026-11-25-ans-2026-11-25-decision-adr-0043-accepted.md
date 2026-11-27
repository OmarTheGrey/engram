---
date: 2026-11-25
author: claude-agent
type: decision
card: ANS-2026-11-25
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0043-decision-export-egress.md
  - docs/tasks/lead-decisions.md
  - packages/core/src/export/otel.ts
  - packages/core/test/unit/export/otel.test.ts
  - packages/server/test/export.test.ts
supersedes: none
---

**What.** ADR 0043 (decision export and egress) is accepted by the lead, item 61 (a), as written.

**Why.** The lead wrote "accept the adrs" on 2026-11-25: his own answer, not one under the delegation, option (a) of each item.

**Result.** The text matches option (a): off unless a sink is named, `OTEL_*` never turns it on, a span carries no content, content hash, store path or free-text reason clause, and there is no content mode. The mapping is `decisionSpan` in `packages/core/src/export/otel.ts`, held by the content-free test in `packages/core/test/unit/export/otel.test.ts`; the switch is in `packages/server/src/export.ts`, tested by "no flag and no variable names no sink, whatever OTEL_* says" in `packages/server/test/export.test.ts`.

**Consequence.** No text change.

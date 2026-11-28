---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.14
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/schema.ts
  - docs/tasks/D5.md
  - docs/tasks/D4.md
supersedes: none
---

**What.** `procedures.safety_scan` takes `off`, `report` or `hold`, and `procedures.drift` is an object with an optional `environment_change` switch and an optional `period` in seconds.

**Why.** D5 names `hold` and says a warning annotates, so a scan that only annotates needs its own value. D4 re-validates "when its environment hash changes or a period passes, the period from the policy": two triggers, each set alone; seconds match `ttl` and every other duration in the policy.

**Result.** `SafetyScanMode` and `DriftOptions` in `packages/core/src/schema.ts`.

**Consequence.** If D5 or D4 needs another value or field, that is a second schema pull request (the card's stated risk).

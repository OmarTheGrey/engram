---
date: 2026-11-19
author: claude-agent
type: decision
card: L3
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/lint.ts
  - docs/decisions/0017-cached-metered-seeded-model-calls.md
supersedes: none
---

**What.** A model finding's lint event carries the usage of the call behind it in MemoryEvent's existing `usage` field.

**Why.** ADR 0017 wants usage of calls made on the plane's behalf in the log; the field exists, so no schema change is needed. A cache hit returns the recorded usage, so a replay writes the same events.

**Result.** Deterministic findings carry no usage; calls that passed, refused or were malformed have their usage in the runner's usage.json only.

**Consequence.** A cost ledger read from the log alone undercounts model-lint spend; the runner's usage.json is complete.

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
  - docs/research/preregistration.md
  - packages/model/src/cached.ts
supersedes: docs/log/2026-11-21-answers-decision-lead-m2-reasoning.md
---

**What.** Item 57 now holds the lead's words only; the reasoning allowance and the comparison across configurations are recorded as added under the delegation (verification findings V-2 and V-5).

**Why.** The lead said M2 runs at its provider's default effort on a pinned endpoint, its reasoning tokens metered and the report stating it, with M1 and M3 reasoning off. The ledger's `UsageRecord` counts reasoning tokens inside `output_tokens` and has no field of its own for them.

**Result.** v1 says the reasoning tokens are counted and priced inside output tokens, not recorded on their own; a backlog row adds `reasoning_tokens` before M2's first run, after Gate C, not a pre-tag item.

**Consequence.** M2's reasoning is priced now and reported on its own once that card lands.

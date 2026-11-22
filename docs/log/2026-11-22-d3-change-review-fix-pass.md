---
date: 2026-11-22
author: claude-agent
type: change
card: D3
chapter: implementation
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/distill/validate.ts
  - packages/runner/src/replay-validate.ts
  - docs/decisions/0045-replay-validation-source.md
  - "make run CONFIG=research/configs/d3-validate-fixture.json"
supersedes: none
---

**What.** Card D3's review fix pass. D3-3 and D3-6: the replay is bound to the item and to its distill ref, a mismatch is a deny event, and the reason carries the replay's sha256. D3-4: ADR 0045's README sentence and lead-decisions item 63. D3-5: oracle and invariant 2. D3-8, D3-10 to D3-12: copied tasks refused, exact stated outcome, miss message asserted, the files decision.

**Why.** The review's findings other than D3-1, D3-2 and D3-7, which wait on the lead.

**Result.** Acceptance unchanged: "model calls: 0 new, 98 from cassettes", edit-a-file-and-check-the-edit active, the three others candidates. Each promote reason now ends in the replay's sha256.

**Consequence.** The pass rule and the threshold stay as they were until the lead answers D3-1.

---
date: 2026-11-28
author: claude-agent
type: decision
card: X18
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/governance-faults/inject.ts
  - packages/core/src/lint/det.ts
supersedes: none
---

**What.** A lint detects a fault when the lint that checks the field the operator corrupts (orphan for deletion, expired-validity for supersession, missing-provenance for missing metadata) names the target with a finding the clean state lacks; every other new finding on the target is counted apart (`new_findings_on_target`).

**Why.** The first fixture run counted any new finding. Restoring a closed version makes it readable again, so the lints reach it and raise its natural missing-provenance finding (B5's assistant turns name no model): a detection that says nothing of the fault.

**Result.** On the fixture, missing metadata is detected at both places and no deletion or supersession is; the reachability findings stay visible in their own column.

**Consequence.** If this is wrong, a lint that catches a fault through another field is undercounted, though its finding still shows in the separate column.

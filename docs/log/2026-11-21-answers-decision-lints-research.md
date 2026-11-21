---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: H3
evidence:
  - docs/tasks/lead-decisions.md
  - docs/decisions/0008-two-tier-lints.md
  - docs/research/preregistration.md
  - research/results/h3-fault-set.json
  - docs/roadmap.md
supersedes: none
---

**What.** The lint and research answers (lead-decisions items 43 to 48) are carried into v1's H3, ADR 0008, PINS.md, the roadmap's risks and the backlog.

**Why.** They settle what card L2's and L4's reviews left for the lead before the tag.

**Result.** H3's primary test is the model tier (23); its deterministic claim is precision on natural memory through the audit sample, seeded recall a regression check (45). The L3 pilot's bound is a standard deviation of at most 0.05 per lint (43). A later update of the same attribute is a contradiction (44). B5 names its assistant model, so missing-provenance does not flag 124,334 of 246,750 turns (46, `research/results/h3-fault-set.json`). The live lint run covers all 500 questions (47). MPBench stays a candidate (48).

**Consequence.** Items 44 and 46 change prompts and cassettes and move committed results, so each is its own PR (backlog).

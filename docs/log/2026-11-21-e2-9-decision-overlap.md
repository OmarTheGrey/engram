---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/secrets.ts
supersedes: none
---

**What.** Overlapping matches resolve to one per region, the BLOCK tier first, then the rule earlier in the table, then the earlier start; caura kept the longest span.

**Why.** caura resolves for masking, where the widest span matters. A reason should name the most specific kind: with longest-first, `aws_session_token=<value>` was reported as `secret/high-entropy`, since the entropy rule's run swallows the key name.

**Result.** The table's order is vendor rules, heuristics, personal data, gitleaks, so a hand rule names a vendor key before gitleaks' duplicate does.

**Consequence.** If wrong, a reason's reported length is a narrower span than another rule saw; the decision is the same.

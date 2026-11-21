---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/lead-decisions.md
  - docs/decisions/0005-bi-temporal-validity.md
  - docs/decisions/0006-scope-owner-grants-typed-policy.md
  - docs/decisions/0007-write-gate-and-source-isolation.md
  - docs/decisions/0009-retrieval-explanations.md
  - docs/decisions/0010-retention-retires.md
  - docs/decisions/0013-adapter-contract-and-conformance.md
  - docs/decisions/0018-duplicates-without-embeddings.md
  - docs/decisions/0025-retention-semantics.md
  - docs/decisions/0027-http-contract-client-and-inspector.md
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
supersedes: none
---

**What.** The ADR and policy answers (lead-decisions items 19 and 34 to 42, rows RV4 and RV7) and items 49 to 55's targets are recorded as dated amendments, and the proposed amendments they decide are marked accepted under the delegation.

**Why.** An ADR change is recorded where it is read; R1's answers card marked accepted amendments in place.

**Result.** Accepted: RV5's access clock in ADRs 0005, 0025 and 0027 (19); RV7's owner rules in 0006 and 0034 (39); RV7's events in 0009 and 0027 (40); L1's in 0018 (37). New amendments: 0010's four questions (38), 0013 any-term search (41), 0007 the confidence floor (42), 0034's questions, promotions and grantees (34 to 36), and 0003, 0004, 0006, 0007, 0025 and 0027 pointing to ADRs 0038 to 0041 and items 54 and 55. ADR 0034 stays proposed.

**Consequence.** Items 34, 36, 38 and 41 need code (backlog).

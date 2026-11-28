---
date: 2026-11-29
author: claude-orchestrator
type: decision
card: E9.11
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0051-crypto-shredded-erasure.md
  - docs/tasks/lead-decisions.md
supersedes: none
---

**What.** ADR 0051 (card E9.11: crypto-shredded erasure, a data key per person scope wrapped under an operator key behind an injected provider; shredding adds to redaction) is accepted under the lead's delegation.

**Why.** The lead's answer of 2026-11-28 allows new ADRs as needed, none contradicting the set. The independent review of E9.11 found it contradicts no accepted ADR (0010 with E1.7's amendment, 0021, 0024, 0038 with E1.9's) and its fix pass corrected the threat model, the nonce rule, promotion out of a person scope and re-keying. The index admits no proposed ADR.

**Result.** Index row and Status line read accepted under the delegation; the lead may overturn it.

**Consequence.** Card E9.13 builds shredding in offboarding on it; nothing calls the key table until then.

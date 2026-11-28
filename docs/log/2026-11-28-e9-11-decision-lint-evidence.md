---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.11
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0051-crypto-shredded-erasure.md
supersedes: none
---

**What.** Both of the review's options for lint evidence: the ADR lists it, with provenance refs and hashes, as plaintext in copies taken before the redaction, and decision 4 has E9.13 seal the evidence part of a lint reason about a person-scope item under its scope key.

**Why.** Model lints quote item text in their evidence, so leaving it plaintext keeps a copy of content shredding is meant to reach; the provenance ref and hashes are store keys and hashes the plane matches on, so they stay plaintext and are stated.

**Result.** ADR 0051 decision 4 and "What is not protected".

**Consequence.** If wrong, E9.13 drops the evidence seal and the limit stands as stated.

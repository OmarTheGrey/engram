---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0013-adapter-contract-and-conformance.md
supersedes: none
---

**What.** For I-6, the churn of two copies adopted in turn is documented, not prevented.

**Why.** Core cannot tell a copy from a move: both list the same refs under new ids. Preventing it would need the store's identity in the ref or two adapter names, which the surfaces do not give; ADR 0013 already prescribes two adapter names for two folders.

**Result.** ADR 0013 and docs/dogfood.md name the churn and the remedy.

**Consequence.** A member who keeps two copies under one name pays two events per file per adoption.

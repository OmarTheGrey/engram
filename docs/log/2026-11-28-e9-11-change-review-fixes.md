---
date: 2026-11-28
author: claude-agent
type: change
card: E9.11
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/crypto/keys.ts
  - packages/core/test/unit/crypto/keys.test.ts
  - docs/decisions/0051-crypto-shredded-erasure.md
supersedes: none
---

**What.** The independent review's fixes (approve with changes): the provider's nonce contract, every wrap checked to open again before it is stored, a rotation refusing the same operator key id, the recorded algorithm checked on unwrap, times checked with core's `Timestamp`; in the ADR, the plaintext left in pre-redaction copies, promotion written unsealed, the write into a shredded scope refused under `shred`, the cost of rotation to backups, SQLite and Postgres residue, the KMS wording and the ADR 0003 and 0010 attribution.

**Why.** Review findings 1 to 11 and 13.

**Result.** `make test-one T=packages/core/test/unit/crypto/keys.test.ts`: "Tests 32 passed (32)". The three mutants the review found surviving are killed: no transaction in `ensureDataKey` (1 failed), no unwrapped length check (2 failed), no wrapped length check (2 failed).

**Consequence.** E9.13's list grows (`2026-11-28-e9-11-finding-for-e9-13.md`).

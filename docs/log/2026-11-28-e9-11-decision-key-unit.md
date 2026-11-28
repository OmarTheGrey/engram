---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.11
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/crypto/keys.ts
supersedes: none
---

**What.** One versioned key per person scope; role, team and org scopes have none; a shredded scope is not re-keyed.

**Why.** The plane erases a person at a time, so Compartment's per-record keys buy nothing; ADR 0010's item 38 keeps promotions out of the person scope and keeps an offboarded scope empty. The version column leaves room for a re-added person.

**Result.** `ensureDataKey` refuses a non-person scope and a shredded one (`DataKeyShreddedError`), tested on both backends.

**Consequence.** If a re-added person must write again, a later card adds a re-key call that makes version 2.

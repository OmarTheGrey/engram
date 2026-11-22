---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/chain.ts
  - packages/core/src/db/migrate.ts
supersedes: none
---

**What.** Card E8.12's event_attestations rows (migration 6, not merged) stay outside the chain for now; migration 5 applies before or after 6.

**Why.** E8.12 is not on main, so no code here can read its table; the chain covers event bodies only.

**Result.** chain.test.ts applies 5 after a stand-in 6 already applied and before it on a fresh log, on SQLite and Postgres; both verify. An attestation row edited is therefore not detected by the chain yet.

**Consequence.** When both are merged, a card should add each event's attestation digest to its chain record, written in the same transaction.

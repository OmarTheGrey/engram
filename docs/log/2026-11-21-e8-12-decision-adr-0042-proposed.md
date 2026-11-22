---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.12
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0042-verified-actors.md
  - docs/decisions/README.md
  - docs/tasks/lead-decisions.md
  - scripts/test/tasks-and-decisions.test.ts
supersedes: none
---

**What.** ADR 0042 is drafted, status proposed, amending ADR 0027, before any code of card E8.12, and put to the lead as item 60 with its recommendation as (a).

**Why.** Item 54 chose tokens from an external issuer and hashed local API keys, and asked for the subject mapping to be fixed first; ADR 0040 left the HTTP source self-asserted until this card.

**Result.** The operator's subjects file maps an exact issuer and subject, and the key file a key, to one actor with its level, memberships and source. No claim sets any of them, a request may only narrow its memberships, and a source sent on an authenticated call is ignored. A served surface needs a credential flag or `--insecure-loopback`. Each event it appends gets a row in a side table (migration 6). `OWNER_DECIDES` gains 0042.

**Consequence.** Option (b) or (c) would change `packages/server/src/auth.ts` only.

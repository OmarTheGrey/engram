---
date: 2026-11-25
author: claude-agent
type: decision
card: ANS-2026-11-25
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0042-verified-actors.md
  - docs/tasks/lead-decisions.md
  - packages/server/src/auth.ts
  - packages/server/test/auth.test.ts
supersedes: none
---

**What.** ADR 0042 (verified actors) is accepted by the lead, item 60 (a), as written.

**Why.** The lead wrote "accept the adrs" on 2026-11-25: his own answer, not one under the delegation, option (a) of each item.

**Result.** The text matches option (a): the subjects file maps an exact issuer and subject, or a key, to one actor; no claim widens it; a request may only narrow its memberships; a sent source is ignored; a served surface needs a credential or `--insecure-loopback`; the attestation side table names the requester. Enforced in `packages/server/src/auth.ts` (`bindActor`, the subject lookup) and `attest.ts`, tested in `packages/server/test/auth.test.ts`, `keys.test.ts` and `attestation.test.ts`.

**Consequence.** No text change. ADR 0046's decision 7 waits on this ADR, which is now accepted and built for the HTTP surfaces.

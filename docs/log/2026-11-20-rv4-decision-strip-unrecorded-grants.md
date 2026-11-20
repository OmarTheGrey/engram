---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
  - packages/core/src/plane/write.ts
supersedes: none
---

**What.** Adoption strips a grant the plane never recorded for the record's id, rather than denying the record; "recorded" means the plane's current item of that id carries the same grant.

**Why.** The card left strip or deny open. A deny refuses the member's own content for a field the plane can narrow; the plane's rule is to narrow, never widen. Comparing with the current item, not with any past allowed event, means a revoked grant restored from a backup stays revoked.

**Result.** The forged file adopts with no grant, the reason naming each dropped grantee; the owner's grant change keeps its grants on re-read.

**Consequence.** A grant typed into a file by hand no longer takes effect, which ADR 0034's decision 6 had allowed; its amendment says so, and `write-grants.test.ts` pins the dropped grant. Cost if wrong: a hand-typed grant is lost, said only in the event's reason.

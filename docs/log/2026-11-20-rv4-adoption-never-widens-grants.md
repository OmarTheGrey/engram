---
date: 2026-11-20
author: claude-agent
type: change
card: RV4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/write.ts
  - packages/core/src/plane/commit.ts
  - packages/adapters/test/plane/rv4-files.test.ts
supersedes: none
---

**What.** Adoption keeps a store record's grant only when the plane's item of that id carries the same grant, drops any other, and names each grantee in the allow event's reason (RV-ADP-4).

**Why.** A file dropped into Dana's folder under its own new id, with a grant to Mallory, was adopted with the grant, and Mallory read it (the reviewer's forge probe).

**Result.** The probe, with the file named `<id>.md`, on core at `00c606e`: Mallory reads the PIN hint; against branch rv4 Mallory reads nothing and the event says "adoption dropped the grant to person:mallory". Tests: the forge, a grant typed into a plane-written file, a backup restored after a revoke, and the owner's `changeGrants` re-read (grant kept). `sameAsWritten` sets grants aside, so a writer's bytes adopted early stay its own. Mutant "keep all grants" fails two tests.

**Consequence.** A hand-typed grant is no longer adopted (ADR 0034).

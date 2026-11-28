---
date: 2026-11-28
author: claude-agent
type: finding
card: E9.12
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - packages/core/src/oracle.ts
supersedes: none
---

**What.** The twin dogfood's violation report counts consent refusals by rule but does not yet judge allowed writes against the policy's opt-outs.

**Why.** The report's violations are reads and grant changes; adding a consent count changes its shape and docs/dogfood.md, outside this card's files.

**Result.** `consentForbids` in the oracle is ready for it: the report would replay each allowed write and count one an opt-out covers at its ts.

**Consequence.** A follow-up card adds `violations.consent` to the report, with its test and docs/dogfood.md.

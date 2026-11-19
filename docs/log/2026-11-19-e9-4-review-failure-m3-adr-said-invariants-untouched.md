---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
supersedes: none
---

**What.** Review finding M3 of PR #44: ADR 0034 said the lead-owned invariants file was untouched, which was false.

**Why.** The surface check had been changed to classify `changeGrants` in the same PR, after the ADR was written.

**Result.** The ADR's consequences now list every change this card makes to the file and its oracles.

**Consequence.** None.

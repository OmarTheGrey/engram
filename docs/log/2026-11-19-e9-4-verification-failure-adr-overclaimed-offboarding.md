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
  - docs/architecture.md
supersedes: none
---

**What.** ADR 0034's decision 5 said an offboarding commits under the same lock, so a grant change never brings erased content back; the verification of PR #44 showed that false as written.

**Why.** The re-check under the lock covers the grant change being the slow side. Offboarding deletes the store records before it takes the lock, so a writer committing in that window is not covered (orderings R2 to R4, the finding of the same day).

**Result.** Decision 5 and `docs/architecture.md` now say what the re-check covers and that the cross-handle gap stays open until card E2.6.

**Consequence.** None beyond card E2.6.

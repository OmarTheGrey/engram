---
date: 2026-11-29
author: claude-orchestrator
type: decision
card: E9.12
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0052-consent-declaration-and-topic-matching.md
  - docs/tasks/lead-decisions.md
supersedes: none
---

**What.** ADR 0052 (card E9.12: consent opt-outs are declared in the policy document and match whole words of the content) is accepted under the lead's delegation. The same commit corrects code comments on main that still named ADR XXXX: E9.11's now name 0051, D4's revalidate.ts names 0050.

**Why.** The lead's answer of 2026-11-28 allows new ADRs as needed, none contradicting the set. The ADR builds on ADR 0049 and the twin profile, adds no persisted field and calls no model (rule 4); its alternatives (a consent record, a topic field, model matching) are left to later cards. The index admits no proposed ADR.

**Result.** Index row and Status line read accepted; the lead may overturn it.

**Consequence.** A per-person consent record with events remains a later card.

---
date: 2026-11-21
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: research
hypothesis: H4
evidence:
  - docs/research/preregistration.md
supersedes: none
---

**What.** v1 said M2's reasoning tokens are metered, while the ledger has no field for them (verification finding V-5).

**Why.** The lead's word was copied without checking `UsageRecord`.

**Result.** v1 says they are counted inside output tokens; a backlog row records them.

**Consequence.** Words about code are checked against it.

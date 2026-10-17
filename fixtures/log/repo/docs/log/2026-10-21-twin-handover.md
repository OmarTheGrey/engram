---
date: 2026-10-21
author: fixture
type: decision
card: E9.2
chapter: discussion
pillar: twin
hypothesis: H2
evidence:
  - docs/decisions/0021-twin-scopes.md
supersedes: none
---

**What.** A role scope is handed to a successor by event, never by copy.

**Why.** Copying would duplicate items outside their lineage.

**Result.** ADR 0021 accepted.

**Consequence.** Handover is replayable.

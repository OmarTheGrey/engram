---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/write.ts
  - packages/cli/test/tui/flows.test.ts
supersedes: docs/log/2026-11-23-e8-15c-decision-handoff-members.md
---

**What.** The handoff's Member of is prefilled with the target scope and the item's own scope only when that is not a person scope; it stays editable.

**Why.** Verification N4: a person:dana item's handoff prefilled person:dana for the reviewer, a scope that is its owner's alone.

**Result.** Flow test: a person item widened to team:core prefills `team:core` only; the team-to-org case still prefills `org, team:core` and is allowed. Mutation: dropping the person check fails it.

**Consequence.** None.

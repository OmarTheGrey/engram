---
date: 2026-11-23
author: claude-agent
type: failure
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/actor-switch.test.ts
supersedes: none
---

**What.** The first pass of E8.15c shipped a critical leak: after a change of actor the item page drew the earlier viewer's page, an ancestor's content included.

**Why.** Its tests switched actor nowhere: the item page read its own events run unfiltered and every screen kept its old answer; the leak test opened sam's page in a fresh session only. Parity replayed the TUI's own argv, and no-policy matched words.

**Result.** Fixed in the fix pass (decision-actor-scoped), with tests that switch actor both ways on six screens, and with the mutations of milestone-review-tests.

**Consequence.** A screen holding an answer is tested across a change of actor.

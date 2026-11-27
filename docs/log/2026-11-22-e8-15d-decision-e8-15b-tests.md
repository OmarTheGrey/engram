---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/keys.test.ts
  - docs/log/2026-11-22-e8-15b-decision-not-run.md
supersedes: none
---

**What.** Two of E8.15b's tests in keys.test.ts were rewritten for the new screens: the revoke test reaches the key file by one tab (the Revoke screen holds it under the id, not in a workspace fold), and "does not run serve, mcp or the hook on its own terminal" became "never runs mcp over stdio or the hook on its own terminal", which opens both screens, runs Try it on a command that cannot start, checks that nothing ran in the session, and that the router still refuses both through `act`.

**Why.** E8.15b's decision (not-run) deferred serve to this card, so its assertion that serve does not run is now wrong by design; the rule it guarded, nothing on the TUI's terminal, is kept.

**Result.** keys.test.ts: 21 passed.

**Consequence.** The review of this card should read both rewrites.

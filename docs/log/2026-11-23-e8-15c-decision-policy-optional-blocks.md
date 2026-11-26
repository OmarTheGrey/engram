---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/events.ts
supersedes: none
---

**What.** The Policy screen draws what GET /policy returned and no row for a block it did not return; `content_guards` and `trust` are not drawn as "off (absent)".

**Why.** 8.18's mockup names them, but drawing an absent block means the TUI knowing the policy schema's optional blocks by name, which the no-policy rule keeps out of src/tui. The design also says the screen renders whatever the route returns.

**Result.** A policy that has either block shows it like any other.

**Consequence.** If the route ever returns the absent blocks as such, the screen shows them with no change.

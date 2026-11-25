---
date: 2026-11-25
author: claude-agent
type: decision
card: RD1
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/visible.ts
  - packages/core/src/plane/read.ts
  - packages/mcp/test/read-disclosure.test.ts
supersedes: none
---

**What.** An explanation's `grants_used` (`grants[<i>]:<to>`) is numbered by the grants the reader is shown, not by the grant's place on the stored item, and stored that way, so `explain` returns it.

**Why.** eve's grant second on an item would read `grants[1]`, telling her another grant comes first. Card E2.13-4 kept the same place out of who-can-read. Renumbering keeps the label pointing at the grant in the answer's own `grants` list.

**Result.** eve's read and `memory_explain` show `grants[0]:person:eve`. No committed fixture, cassette or result holds a `grants[<n>]` label above 0 (`grep -rlE 'grants\[[1-9]' fixtures research`: no match), and no prompt carries `grants_used`.

**Consequence.** A surface that maps `grants_used` back to the stored item must use the item it was shown.

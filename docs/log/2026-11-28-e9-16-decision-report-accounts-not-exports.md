---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.16
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/portable.ts
supersedes: none
---

**What.** The subject's own items in scopes not read and items granted to them elsewhere are named by ADR 0047's by-id rule or counted in the report, not exported; own events outside the bundle are counted by operation and decision; a derived item is accounted for once, in the closure; exports are not counted as own events.

**Why.** Exporting them would widen E9.8's bundle rule, which other cards and docs/bundle.md rest on; the report gives the subject what exists without handing out more than a by-id read would. Leaving exports out keeps the report the same for the same log however often it is taken.

**Result.** In the core fixture: one own item withheld, one granted item named, two own events (write allow 1, deny 1) counted.

**Consequence.** Cost if wrong: a later card exports them into the bundle under its own rule.

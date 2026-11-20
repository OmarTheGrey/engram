---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - packages/core/src/dogfood.ts
supersedes: none
---

**What.** A new rule id, `engram/adopt/rekeyed`: a re-keyed record at the ref of an item retired by anything but adoption's retraction, holding that item's content, is refused until it changes.

**Why.** The card asks the move to recover "without losing or resurrecting anything". Without the rule, an item its owner, a ttl or an eviction retired came back active under its new id after a move, though adoption leaves such an item retired while the store holds it unchanged (ADR 0007, D8).

**Result.** One deny event, then quiet; an edit adopts it as new content. The rule id is on the dogfood report's fixed list (`ENGRAM_RULES`), which its test checks.

**Consequence.** Cost if wrong: a retired file the owner wants back after a move must be edited, as before the move.

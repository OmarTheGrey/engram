---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/pi-extension/src/tag.ts
  - packages/pi-extension/test/unit/tag.test.ts
supersedes: none
---

**What.** The memory tag's one renderer (`tagUngovernedRead`) takes optional per-item attributes, rendered after the rank, escaped, with names that cannot reuse the tag's own; PR 3 changed `packages/pi-extension/src/tag.ts`, outside the plan's file list, for it.

**Why.** C4's metadata must reach the model in the shape every condition's reads share (ADR 0015); a second renderer in the runner would drift from it (finding P3-12 asked for this entry).

**Result.** Without attributes the tag is byte for byte C2's and C3's; the tag tests check both and refuse a reused or malformed name.

**Consequence.** None.

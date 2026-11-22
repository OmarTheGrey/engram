---
date: 2026-11-22
author: claude-agent
type: decision
card: E9.8
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/portable.ts
  - docs/bundle.md
supersedes: none
---

**What.** An imported row keeps the confidence its bundle states.

**Why.** Confidence is the row's own estimate, not a trust kind; the gate judges it against the target's floor.

**Result.** A row below the floor is denied as a direct write would be. A bundle can claim a high confidence, which raises nothing the gate rests trust on: the kind is capped, the status is candidate and a reviewer promotes.

**Consequence.** If the lead wants confidence capped too, it is one line in `importedWrite`.

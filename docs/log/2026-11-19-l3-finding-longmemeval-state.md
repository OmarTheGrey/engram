---
date: 2026-11-19
author: claude-agent
type: finding
card: L3
chapter: discussion
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/longmemeval/plane.ts
  - packages/core/src/lint/model.ts
supersedes: none
---

**What.** Neither model lint sends a unit on B5's LongMemEval memory state as it is written: its items are episodic turns in person:user whose refs name sessions, not items.

**Why.** H3 measures the lints on L2's set, built from that state; L2 and L4 need to know what the model tier can see.

**Result.** contradiction reads only semantic items; unsupported-claim needs a ref naming an item with a matching strict hash. B5 writes neither (turnItem in packages/bench/src/longmemeval/plane.ts).

**Consequence.** L2's contradictory faults must be semantic items in the linted scope, and its unsupported faults must cite an item source with its strict hash; otherwise the model tier's recall on them is zero by construction.

---
date: 2026-11-19
author: claude-agent
type: finding
card: L2
chapter: limitations
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/faults/bank.ts
  - packages/bench/src/faults/generate.ts
supersedes: none
---

**What.** An injected attribute can collide with a fact of the question's own history: "My cat's name is Miso" in a history where the user's cat is Luna, or an invented gym beside the user's real one.

**Why.** The generator keeps injected attributes apart within the injected items of a question, but does not read LongMemEval's turns to avoid what they say: matching free text needs a model or a hand check.

**Result.** Such a collision is an unlabelled contradiction between an injected item and a base turn. No deterministic lint sees it, and L3's contradiction lint pairs only semantic items while base turns are episodic, so it reaches neither tier; it would reach a reader of the memory, or a card that extracts facts from the turns.

**Consequence.** Stated as a limit; L4 need not correct for it while base turns stay episodic.

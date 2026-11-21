---
date: 2026-11-21
author: claude-agent
type: decision
card: D1
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/runner/src/recorder.ts
supersedes: none
---

**What.** An episode item is valid from its session header's timestamp (the recording time if that timestamp is invalid), has confidence 1, no ttl and no grants, and status active.

**Why.** Under ADR 0005 the valid time is when the episode happened. The record is exactly what the file holds, and whether the work in it was right is its outcome, not its confidence.

**Result.** All fifty fixture items are admitted by the medium preset's person rule and returned by the read at 2026-11-21.

**Consequence.** Retention and budgets apply as they do to any episodic item (medium: 90 days, 5000 per person). If wrong, the cost is one field's meaning, which a later card can change without touching the parser.

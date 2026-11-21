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
  - docs/decisions/0004-provenance-and-source-trust.md
supersedes: none
---

**What.** The recorder sets the actor's source to `model` for an episode. It sets `compaction` when the episode holds a model-written summary, either a compaction entry or a branch summary.

**Why.** ADR 0004 says an item derived from others takes the least trusted provenance of its inputs. A session mixes user, model and tool content. `compaction` is the trust ceiling for model summaries, and pi writes branch summaries the same way.

**Result.** In the fixtures, 23 items are `compaction` and 27 are `model` (`fixtures/sessions/d1/index.json`). Under the medium preset both are allowed in person scope and denied outside it.

**Consequence.** Episodes cannot leave person scope without a gate pass. If wrong, the cost is that episodes are trusted less than they could be. Raising their trust would need a new decision.

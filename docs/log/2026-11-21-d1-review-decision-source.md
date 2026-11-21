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
  - docs/tasks/backlog.md
supersedes: docs/log/2026-11-21-d1-decision-source.md
---

**What.** The recorder sets the source to `model`, or to `compaction` when a compaction or a branch summary is in the episode. A session holding content fetched from the web would be `external` under ADR 0004's least-trusted rule. Nothing in a pi session marks such content today, so the recorder cannot detect it.

**Why.** The review asked for the gap to be stated. An episode labelled `model` that carries outsider text is trusted more than ADR 0004 allows.

**Result.** In the regenerated fixtures, 20 items are `compaction` and 30 are `model` (`fixtures/sessions/d1/index.json`). A backlog row, "Recorder: external content in sessions", records the gap.

**Consequence.** A harness that labels fetched tool results would let the recorder set `external`. Until one does, the provenance kind of recorded episodes is an upper bound on their trust, not an exact value.

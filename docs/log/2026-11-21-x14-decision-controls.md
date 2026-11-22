---
date: 2026-11-21
author: claude-agent
type: decision
card: X14
chapter: design
pillar: research
hypothesis: none
evidence:
  - fixtures/bench/amsb/controls.json
supersedes: none
---

**What.** Card X14's 43 controls were written afresh in six groups (a twin of each AMSB attack, identifiers, ML documentation, CI and operations, compaction transcripts, security notes) rather than copied from card E2.10's corpus or E2.9's generator.

**Why.** A control set its guard was tuned on says nothing new; E2.9's own config says X14's corpus, unseen by the tuning, is the out-of-sample check.

**Result.** Under the screen at hardened, 4 of 448 controls are held: two CI lines, one compaction transcript with role tags, the size twin.

**Consequence.** They are still self-written, a limit beside the table. Cost if wrong: the false-hold rate's optimism.

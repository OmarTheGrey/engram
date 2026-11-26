---
date: 2026-11-26
author: claude-agent
type: decision
card: R5
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/tests/test_label_audit.py
  - docs/research/label-audit.md
supersedes: none
---

**What.** Card R5 names two config assertions that pin `pause`; only one did (the LongMemEval config test). The second config test checked `on_stop in ON_STOP`, so it now pins `== "drop"` for both configs. The procedure `docs/research/label-audit.md` said in three sentences (lines 77, 102 and 104) that the configs read `pause`; all three now say they read `drop` since R5.

**Why.** Two pinned config tests are what the card asks for, and a procedure that contradicts the configs misleads the members during the audit. The `compare_dir` tests of the default `pause` mode stay, as the card says, and so does that default.

**Result.** One assertion in each of two tests; three sentences in the procedure.

**Consequence.** Nothing else depends on these sentences.

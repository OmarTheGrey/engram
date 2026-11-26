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

**What.** Card R5 names two config assertions that pin `pause`; only one did (the LongMemEval config test). The second config test checked `on_stop in ON_STOP`, so it now pins `== "drop"` for both configs. The procedure `docs/research/label-audit.md`, outside the card's file list, also said both configs still read `pause`; its one sentence now says they read `drop` since R5.

**Why.** Two pinned config tests are what the card asks for, and a procedure that contradicts the configs misleads the members during the audit. The `compare_dir` tests of the default `pause` mode stay, as the card says.

**Result.** One assertion in each of two tests; one sentence in the procedure.

**Consequence.** A reviewer who wants the procedure untouched reverts one line; nothing else depends on it.

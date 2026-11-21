---
date: 2026-11-20
author: claude-agent
type: decision
card: RV8
chapter: design
pillar: research
hypothesis: H2
evidence:
  - research/scripts/label_audit_sample.py
  - docs/research/label-audit.md
supersedes: none
---

**What.** A LongMemEval phase-1 context shows the question, its date and only the sessions the benchmark names as evidence, with no session id, `has_answer` mark, type or answer.

**Why.** A whole S history is about 115,000 tokens, too long for a member to read 50 times; the evidence sessions are where an answer can be checked.

**Result.** Which sessions are shown is itself a label, so phase 1 is blind to the answer and the abstention flag, not to the evidence. The procedure says so. The test checks that no id, mark, type or answer appears in any context.

**Consequence.** If wrong, a member's answerability label is easier than an agent's task; the alternative, the whole history, costs about 50 long reads per member.

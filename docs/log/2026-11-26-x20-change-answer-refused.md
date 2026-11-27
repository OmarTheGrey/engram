---
date: 2026-11-26
author: claude-agent
type: change
card: X20
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/answer-refusal.test.ts
  - packages/runner/src/model/cassette.ts
  - make test-one T=packages/runner/test/answer-refusal.test.ts
supersedes: none
---

**What.** An answer call the provider refuses with an error no retry can fix is recorded in the cassette and its session excluded as `answer refused` on GateMem, MEM-INV-Bench and LongMemEval, counted per condition in each summary.

**Why.** Pre-tag condition 3, lead-decisions item 14: one over-long prompt must not stop a multi-day H1 run.

**Result.** The refusal is a cassette entry marked `REFUSED_ANSWER_MARK`, so a replay excludes the same session with zero calls; its usage reaches the ledger once, through `cached`; an excluded session is not judged; a row and summary of a session that is not refused gain no key. `answer-refusal.test.ts`: 20 tests pass; rv1 (15), rv6 (15), rv1-review (14) unchanged and passing.

**Consequence.** H1's live run excludes, rather than stops on, a context overflow.

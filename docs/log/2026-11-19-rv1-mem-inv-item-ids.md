---
date: 2026-11-19
author: claude-agent
type: change
card: RV1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/mem-inv-probe.ts
  - fixtures/cassettes/b4-mem-inv-probe
  - fixtures/cassettes/x1-h1-mem-inv
  - packages/runner/test/rv1.test.ts
supersedes: none
---

**What.** On MEM-INV-Bench the case's items and the plane's events take ids from separate counters, so the entries are items 1 to n under every condition (review finding RV-EXP-10).

**Why.** The plane's write events shared the items' counter, so under C5 the entries were items 001, 003 and 005 while C2 to C4 showed 001, 002 and 003, so the model read different ids by condition.

**Result.** Events now use the namespace `01920000-0000-7000-9000-...`. The C5 transcripts changed, so the two MEM-INV-Bench cassette sets were recorded afresh from their scripts, as `make fixtures` records them: 1 of 4 cassettes in `b4-mem-inv-probe` and 7 of 49 in `x1-h1-mem-inv` changed, the C5 reads, whose item ids are now C2's (test in `packages/runner/test/rv1.test.ts`). An item the model writes through the plane still takes the event counter, since the plane has one id source.

**Consequence.** GateMem and LongMemEval are unchanged (see the wording finding).

---
date: 2026-10-29
author: claude-agent
type: finding
card: B4
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - fixtures/bench/mem-inv-bench/upstream-golden.json
  - packages/bench/src/mem-inv-bench/score.ts
  - packages/bench/test/mem-inv-bench/score.test.ts
supersedes: none
---

**What.** MEM-INV-Bench's bucketer raises TypeError on a reply whose `tool` is a list or an object, where the port buckets it OTHER.

**Why.** Review finding R6-10; upstream tests `a.get("tool") not in TOOLS` against a set, which needs a hashable value.

**Result.** The golden script now records both rows as `raises` (`TypeError: unhashable type: 'list'` and `'dict'`); the port's comment states the difference and a test holds it to OTHER and UNREAD, which never counts as a hit or a refusal.

**Consequence.** A live run whose model returns such a reply is scored where upstream's run would stop; the live half reports any such rows.

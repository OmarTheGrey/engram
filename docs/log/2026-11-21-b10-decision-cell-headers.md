---
date: 2026-11-21
author: claude-agent
type: decision
card: B10
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/model/src/proxy.ts
  - packages/model/test/proxy.test.ts
supersedes: none
---

**What.** The experiment cell (harness, item, condition, preset, store, seed) comes from the proxy's start-up `context` and the `x-engram-*` headers: a header fills a field the configuration leaves open, must agree with a field it fixes, and a field set by neither is a 400.

**Why.** The card names both sources without an order. Letting a header override the configuration would let a harness change the experiment config's seed (rule 6).

**Result.** Tests: a missing item is a 400 naming the item; a seed header of 2 against a configured seed of 1 is a 400 naming the seed; a body `seed` other than the cell's is a 400.

**Consequence.** B7 and B11 fix what a run shares at start and send the item per request.

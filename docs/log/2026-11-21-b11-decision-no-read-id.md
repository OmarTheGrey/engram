---
date: 2026-11-21
author: claude-agent
type: decision
card: B11
chapter: design
pillar: research
hypothesis: H5
evidence:
  - packages/bench/scripts/tau2_memory.py
  - packages/bench/test/tau2/shim.test.ts
supersedes: none
---

**What.** C5's memory_read result in tau2 is tagRecall's tag without the `read_id` attribute; the rest is as the pi extension renders it. Item ids are UUID version 7 in shape, drawn from a hash of the run, task and tool call id.

**Why.** `engram serve` draws read ids at random, and a prompt holding one has a new prompt hash on every run, so no C5 call after a read would ever replay from a cassette (rule 7). The runner's C5 draws from a seeded id sequence instead.

**Result.** The shim test checks the rendering against tag.ts with the read id removed; a second offline run of the slice made 0 new calls under C5.

**Consequence.** C5's tag differs from the runner's by one attribute. If the lead wants it, `engram serve` needs a seeded id source (another card).

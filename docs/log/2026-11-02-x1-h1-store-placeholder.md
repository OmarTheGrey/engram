---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/configs/b3-gatemem-plane.json
  - research/configs/h1-gatemem.json
  - research/configs/h1-mem-inv.json
supersedes: none
---

**What.** Both H1 configs name the store `fake`, a placeholder PR 4 confirms or replaces.

**Why.** The plan asks for the store card B3's config treats as primary; B3's config lists `["fake", "mem0", "letta"]` and nothing in B3's log ranks them, so the first listed is taken. H1 is about the condition, not the store (H4 compares stores), and the fake store is in process, deterministic and passes the conformance suite.

**Result.** Changing the store is one field per config; the session counts do not change, since every condition but C1 runs once per store.

**Consequence.** PR 4's decision sheet should ask the lead whether H1 runs on a real store (Mem0 or Letta), whose own search then meets the model's queries in C2 to C4.

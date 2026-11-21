---
date: 2026-11-20
author: claude-agent
type: failure
card: RV7
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/write-grants.test.ts
supersedes: none
---

**What.** Review finding RV7-R4: no test pinned the promotion exemption, so the mutant that drops `options.promotion &&` survived.

**Why.** Every co-holder rewrite in the tests went through a harness source, which changes the provenance, so the item never differed only in status and version. My first new test also failed to kill the mutant: it rewrote the item as written, whose `store_ref` differs from the projected one.

**Result.** The test now takes the projected item and has a source-less Lee (provenance as claimed) retire it at version plus one. It gets `engram/grant/owner`. With the mutant applied it fails.

**Consequence.** Nothing else.

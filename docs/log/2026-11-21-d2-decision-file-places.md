---
date: 2026-11-21
author: claude-agent
type: decision
card: D2
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - fixtures/distill/d2-induce-script.json
  - packages/core/scripts/skill-spec-golden.py
supersedes: none
---

**What.** Two files sit outside the card's file list. The scripted model's replies are in `fixtures/distill/d2-induce-script.json`, which follows L3's `fixtures/lint/`. The validator's golden script is `packages/core/scripts/skill-spec-golden.py`.

**Why.** `make fixtures` deletes and re-records the cassette folder, so a script inside it would be lost. A session folder is globbed by other tests.

**Result.** Both are small. The golden script runs only at development time, on an upstream checkout under `.engram/upstream`.

**Consequence.** None.

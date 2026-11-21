---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/stateful.test.ts
supersedes: docs/log/2026-11-21-e1-4-decision-known-gaps-relaxed-and-pinned.md
---

**What.** The main property relaxes four pinned gaps, each by name (F1, F3, F4, F6), and `strict` judges any set of them; each pinned test turns on only its own.

**Why.** With one switch, a strict run stopped at the first gap (F3 today), hiding the others' current counterexamples (review finding E1.4-6).

**Result.** F1: after a crash the store's grants may exceed the projection's, never lack one. F3: the oracle's "held untrusted content" detail is filtered only when every raise of the item, or of the source it was promoted from, is its owner's own user-sourced write, never an adoption. F4: up to three adoption passes. F6: an item retired after a co-holder's adoption denied its record under the owner rule. `ENGRAM_STATEFUL_STRICT=F1,F3` sets them from the environment.

**Consequence.** When core fixes a gap, its pinned test fails and its relaxation goes.

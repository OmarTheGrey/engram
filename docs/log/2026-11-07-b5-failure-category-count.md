---
date: 2026-11-07
author: claude-agent
type: failure
card: B5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/test/longmemeval/load.test.ts
  - "pnpm exec vitest run packages/bench/test/longmemeval"
supersedes: none
---

**What.** `load.test.ts` first expected 24 fixture questions and got 20.

**Why.** The test multiplied the twelve category names the vendoring script lists (each of six types, with and without `+abstention`) by two picks, but upstream has no abstention question of the single-session-preference and single-session-assistant types, so only ten categories exist and the script skips the empty two.

**Result.** The test now counts the categories present (ten) and checks two questions of each, in order; it passes.

**Consequence.** Nothing else changes; the fixture was right.

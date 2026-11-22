---
date: 2026-11-21
author: claude-agent
type: decision
card: D2
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/distill/induce.ts
  - docs/decisions/0012-induction-awm-over-pi-sessions.md
  - fixtures/cassettes/d2-induce-fixture
supersedes: none
---

**What.** AWM's WebArena induction prompt is adapted to tool-use sessions, one prompt part at a time. The instruction keeps every sentence's role: web tasks become tool-use tasks, actions become tool calls, and input text and buttons become paths, symbols and arguments. Two sentences are added, on abandoned attempts and on the `Workflow`/`Use when:` format. The one-shot keeps its shape with a new synthetic tool-use example. The assembly, the think and action blocks, temperature 1.0 and 2048 tokens are kept.

**Why.** ADR 0012 says to vendor the prompt verbatim, and the card asks for an adaptation. A web prompt asks a model about clicks.

**Result.** `AWM_INSTRUCTION` and `AWM_ONE_SHOT` are in `induce.ts`, cited, and the original text is at the commit `NOTICE` names. PR.md sets the two side by side.

**Consequence.** This departs from ADR 0012's word "verbatim". The lead may want an ADR amendment.

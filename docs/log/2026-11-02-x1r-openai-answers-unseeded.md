---
date: 2026-11-02
author: claude-agent
type: finding
card: X1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/model/cassette.ts
  - "grep -o '\"api\":\"[a-z-]*\"' <pi-ai 1.3.0>/dist/providers/data/openai.json | sort | uniq -c"
supersedes: none
---

**What.** pi-ai 1.3.0 serves all 44 of OpenAI's models on the Responses API, and the runner refuses a live answer model on any API but OpenAI-compatible chat completions, the only one that sends a seed.

**Why.** Wiring the live judge (J1) meant reading which API pi-ai uses for `openai/gpt-4o`.

**Result.** So no OpenAI model can be H1's answer model through pi-ai's built-in providers today without relaxing ADR 0017's rule (finding R7-7). The judge, at temperature 0, sends no seed by decision.

**Consequence.** PR 4's choice of M1 should take a provider pi-ai serves on a seeded API, or the lead relaxes the rule for OpenAI.

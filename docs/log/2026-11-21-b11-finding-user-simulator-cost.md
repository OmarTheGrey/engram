---
date: 2026-11-21
author: claude-agent
type: finding
card: B11
chapter: evaluation
pillar: research
hypothesis: H5
evidence:
  - fixtures/cassettes/b11-tau2-fixture
  - packages/bench/src/tau2/summary.ts
  - "make bench BENCH=tau2"
supersedes: none
---

**What.** The cost note the card asks for: what the user simulator's cassettes add to a deposit (ADR 0036), from the slice's summary.

**Why.** tau2 calls an LLM user simulator on every episode, which the other benchmarks do not.

**Result.** Of 62 cassettes, 24 are the user simulator's (39 percent of files) but 72,752 of 1,301,592 bytes (5.6 percent); an agent cassette averages about 32 KB, since each request carries airline's policy and 14 tool definitions, a user cassette about 3 KB. The scripted replies are short and report zero tokens, so no token or dollar cost is measured here; the ledger has the rows for X11's live run.

**Consequence.** A deposit's size is driven by the agent's prompts, not the user simulator's; X11 reports the live per-role token split from usage.jsonl.

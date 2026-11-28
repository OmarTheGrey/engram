---
date: 2026-11-28
author: claude-agent
type: finding
card: E2.18
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - research/results/h2-cedar-properties.json
  - research/configs/h2-cedar-properties.json
supersedes: none
---

**What.** The result's bytes are shown stable only on Windows.

**Why.** The result holds the solver's counterexamples, whose values cvc5 chooses; the Linux and macOS builds of cvc5 1.4.2 are pinned but were not run.

**Result.** Five runs on this Windows machine give sha256 `9e6d4084...`. On another platform the verdicts should not change, but a counterexample's values might, and make test-repro would then report a mismatch on that row.

**Consequence.** The first run on Linux or macOS checks it; if the bytes differ, the result should keep only the verdicts and the evaluator's replay, or be made per platform.

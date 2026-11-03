---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/tests/test_h1_pipeline.py
  - packages/runner/test/research/h1-sessions.test.ts
supersedes: none
---

**What.** The end-to-end test of H1's pipeline passed with a mutated converter that ignored the judge, read `privacy_leak` at forgetting checkpoints and stopped excluding EXCLUDED and FILTERED replies; only the vitest file caught them.

**Why.** The fixture probe has one access checkpoint whose judge agrees with the rule, one utility checkpoint, and one attack that always hits, so its table cannot tell those converters apart. Found by the review (P4A-4).

**Result.** `test_a_planted_run_through_the_cli_converter_gives_the_tables_rates_and_exclusions` plants a forgetting checkpoint, a judge disagreeing with the rule, a null judge verdict, EXCLUDED, FILTERED, MALFORMED and two UNREAD rows and a readings file, runs the CLI converter and `h1_table.py`, and asserts the rates and exclusion counts. Five mutants, the review's three, the old UNREAD mapping and readings ignored, each fail it.

**Consequence.** An end-to-end test plants every branch it claims to cover.

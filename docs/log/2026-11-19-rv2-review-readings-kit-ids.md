---
date: 2026-11-19
author: claude-agent
type: change
card: RV2
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/research/h1-sessions.test.ts
  - research/tests/test_h1_pipeline.py
  - "pnpm exec vitest run packages/runner/test/research/h1-sessions.test.ts: 30 passed"
  - "uv run pytest research/tests/test_h1_pipeline.py: 5 passed"
supersedes: docs/log/2026-11-19-rv2-readings-kit.md
---

**What.** The readings kit as RV2's first pass left it, with RV2-1's change. There are two templates, each with its id filled in. `READINGS=<reader1's file>,<reader2's file>` joins them. The join refuses one file or three, the same id twice, any id but `reader1` and `reader2`, the shared `/1` file, a key entry with no reply in one reader's file, and every earlier refusal.

**Why.** RV-EXP-7, then RV2-1 and RV2-6.

**Result.** A new pytest test, `test_the_readings_instructions_name_the_pseudonymous_ids_and_ask_for_no_name`, reads the help, AGENTS.md, the `how_to` and plan step 6. It finds `reader1` and `reader2` in each and no instruction to write a name. It failed before the docs changed. Six mutants of the join were each killed by one test: no-reply, coverage, file count, distinct ids, id set, and `h1-readings/1` ids.

**Consequence.** The committed readings carry only the two ids.

---
date: 2026-11-19
author: claude-agent
type: change
card: RV2
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - packages/runner/scripts/h1-sessions.ts
  - packages/runner/test/research/h1-sessions.test.ts
  - research/tests/test_h1_pipeline.py
  - "pnpm exec vitest run packages/runner/test/research/h1-sessions.test.ts: 29 passed"
  - "uv run pytest research/tests/test_h1_pipeline.py: 4 passed"
supersedes: none
---

**What.** The template is now `h1-blind-readings/2`: an empty `reader`, then one empty `verdict` per reply. `make h1-table READINGS=<a's copy>,<b's copy>` joins the two files through the key.

**Why.** RV-EXP-7. Neither reader sees the other's verdicts, no one merges copies by hand, and a missing verdict is refused.

**Result.** The join refuses one file or three, two files by one reader, an empty name, the shared `/1` file, and a key entry with no reply in either copy. Readings that leave an UNREAD session unread are refused. Every earlier refusal is kept. Four mutants were each killed by one test: the no-reply check, the coverage check, the file count and the distinct names. The pipeline test runs two copies through the CLI (one reply agreed, one disagreed) and checks the refusals.

**Consequence.** The help, AGENTS.md, CLAUDE.md, both `how_to`s and plan section 7 now name two files.

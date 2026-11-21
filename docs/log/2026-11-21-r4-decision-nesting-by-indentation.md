---
date: 2026-11-21
author: claude-agent
type: decision
card: R4
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/scripts/crosswalk.py
  - research/tests/test_crosswalk.py
supersedes: none
---

**What.** The crosswalk reads a test's nesting from indentation and checks only the `describe` blocks a row names; an empty list means anywhere in the file.

**Why.** The orchestrator asked for plain text matching, not a vitest run. Counting brackets in TypeScript breaks on regular expressions and template literals; biome, which `make lint` runs, indents every block body past its opening line, so a block ends at the next line indented no further. Some files wrap their tests in a `describe` with a computed title (per backend), which no text check can resolve, so unnamed blocks are not checked.

**Result.** A test in a sibling block, or outside the named block, is refused; tests in `research/tests/test_crosswalk.py` show both.

**Consequence.** A multi-line string at column 0 inside a block ends it early, which fails closed (the test reads as missing). A computed title cannot be named.

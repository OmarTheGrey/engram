---
date: 2026-11-28
author: claude-agent
type: change
card: E2.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/explain-absent.test.ts
  - packages/cli/test/parity.test.ts
  - packages/cli/test/tui/parity.test.ts
supersedes: none
---

**What.** The review's findings 1 to 6 and 8, fixed: the read explained is stated precisely, one snapshot, an item-by-item check, CLI and TUI denied-and-missing pairs, the store flags, `n` from the read screen tested, the card's status line.

**Why.** The independent review of the branch (approve once finding 1 is documented).

**Result.** The acceptance (15 tests) now checks, for every item in a scope the reader may read, that a by-id read at the same times records the one filter category its stage names, or returns it; the fixtures reach status and ttl. Through the CLI and the TUI, for each probe actor and hidden canary, plain and --json, a hidden id and a never-held one answer alike. The read screen's hint no longer shows n while its query field has focus.

**Consequence.** The leakage row moves again, by the new comparisons.

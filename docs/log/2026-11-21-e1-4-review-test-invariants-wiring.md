---
date: 2026-11-21
author: claude-agent
type: change
card: E1.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - Makefile
  - AGENTS.md
  - CLAUDE.md
  - "make test-invariants"
supersedes: docs/log/2026-11-21-e1-4-test-invariants-wiring.md
---

**What.** The `make test-invariants` line of AGENTS.md and CLAUDE.md names the three replay variables, `ENGRAM_STATEFUL_SEED`, `ENGRAM_STATEFUL_PATH` and `ENGRAM_STATEFUL_REPLAY`, and `ENGRAM_STATEFUL_STRICT`.

**Why.** Review finding E1.4-1: the earlier line promised a replay from seed and path, which fast-check refuses for a command list without its replay path.

**Result.** Both files changed identically (`cmp AGENTS.md CLAUDE.md` reports no difference); the Makefile target is unchanged and runs `test/property/invariants.test.ts test/property/stateful.test.ts`.

**Consequence.** The documented replay is the one that works.

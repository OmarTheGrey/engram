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
supersedes: none
---

**What.** `make test-invariants` now runs `test/property/stateful.test.ts` after `test/property/invariants.test.ts`; AGENTS.md and CLAUDE.md describe it identically, with the three environment variables (`ENGRAM_STATEFUL_RUNS`, `ENGRAM_STATEFUL_SEED`, `ENGRAM_STATEFUL_PATH`).

**Why.** Step 5 of card E1.4: the stateful model is part of the always-on invariants gate.

**Result.** Before: `vitest run test/property/invariants.test.ts`. After: `vitest run test/property/invariants.test.ts test/property/stateful.test.ts`. The lead-owned invariants file is unchanged. The stateful file also runs in `make test`, as every test file does.

**Consequence.** A sequence that breaks an invariant fails the invariants gate with its seed and path.

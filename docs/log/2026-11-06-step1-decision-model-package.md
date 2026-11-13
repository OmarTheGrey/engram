---
date: 2026-11-06
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/decisions/0033-shared-model-package.md
supersedes: none
---

**What.** The shared model-call layer became its own package, `@engram/model`, rather than types in core and the cached call in bench (ADR 0032, proposed for the lead).

**Why.** The backlog item left the choice open. Core may hold types but never a model call (AGENTS.md rule 4), and the cache writes cassette files; putting the cache in bench would make the runner import its own cache from a benchmark package; keeping the runner as bench's dev dependency would keep the cycle through tests.

**Result.** `@engram/model` depends on `@engram/core` and pi-ai 1.3.0 only (pi-ai for the faux provider the scripted models use, already pinned in `docs/deps.md`), and on neither bench nor runner, which `packages/bench/test/load.test.ts` checks.

**Consequence.** The lead accepts or replaces ADR 0032. No new external dependency.

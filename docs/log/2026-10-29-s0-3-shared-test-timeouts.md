---
date: 2026-10-29
author: claude-orchestrator
type: failure
card: S0.3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - vitest.shared.ts
  - scripts/vitest.config.ts
  - "make test"
supersedes: none
---

**What.** Each test project now has a vitest.config.ts taking 30 s per test and 60 s per hook from vitest.shared.ts, in place of vitest's 5 s and 10 s.

**Why.** On 2026-10-29, full `make test` runs on a busy machine failed on whichever test came first in a file (13 CLI tests, then a conformance case, then a lock test); each passed when rerun, and workers took about 6.5 s to start. Root config settings do not reach the projects, and `pnpm --filter <package> test` does not read the root file.

**Result.** At a 1 ms shared timeout, tests time out under both `make test` and a package's `pnpm test`; at 30 s the suite passes, with project names unchanged.

**Consequence.** A slow machine no longer fails the suite at random; a hanging test still fails.

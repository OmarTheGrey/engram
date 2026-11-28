---
date: 2026-11-28
author: claude-agent
type: decision
card: X19
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/residue/backend.ts
  - packages/core/test/db/embedded-postgres.ts
supersedes: none
---

**What.** The check starts its Postgres through core's `loadEmbeddedPostgres` (`packages/core/test/db/embedded-postgres.ts`), imported by relative path, with a data directory of its own.

**Why.** That loader strips the exit hooks that once turned failing runs into exit 0, and its header says any package may reuse it, so the bench package needs no dependency of its own. The data directory must be known to read its bytes, and core's `startEmbeddedPostgres` hides it.

**Result.** No package.json or lockfile changes.

**Consequence.** None. Cost if wrong: a dev dependency line in bench.

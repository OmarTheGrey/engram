---
date: 2026-10-29
author: claude-agent
type: change
card: E0.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/setup.ts
  - packages/cli/src/doctor.ts
  - packages/cli/test/setup.test.ts
  - packages/cli/test/doctor-review.test.ts
  - scripts/test/no-docker.test.ts
  - "pnpm --filter @engram/cli test"
  - "make test-e2e"
supersedes: docs/log/2026-10-29-e0-4-postgres-targets.md
---

**What.** Review P3 of E0.4, fixed test first. This corrects the earlier claim that every error and label shows the password as `***`.

**Why.** The reviewer found leaks: a malformed URL, a query-string password and a misspelt scheme. The doctor also migrated logs, and the explain hint printed a URL that could not be run.

**Result.**
- Labels now hide the whole userinfo and any parameter matching pass, secret, token or key.
- Another scheme, or a URL postgres.js cannot parse, exits 2 within seconds.
- A server-echoed secret is scrubbed; removing that scrub fails a test.
- Doctor inspects read-only and reports pending migrations without applying them.
- Unreadable memory files and empty key variables are caught, and the pins check is tightened.
- The no-docker scan also covers containers and test sources.

121 CLI tests pass.

**Consequence.** E0.4 awaits re-review.

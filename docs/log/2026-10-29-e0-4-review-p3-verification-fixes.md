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
  - packages/cli/test/review-verification.test.ts
  - scripts/test/no-docker.test.ts
  - "pnpm --filter @engram/cli test"
supersedes: docs/log/2026-10-29-e0-4-review-p3-fix-pass.md
---

**What.** These are the fixes for the verification of review P3, test first. They correct the fix-pass claim that only secret-looking query values were hidden.

**Why.** An `@` in a query value was read as the end of the userinfo. That leaked the rest of the secret and hid the host (P3-16). There were also four smaller defects:
- one-letter passwords garbled messages (P3-17);
- write converted foreign databases into logs (P3-18);
- a non-database file went unnamed (P3-19);
- `docker.exe` and `nerdctl` slipped past the no-docker test.

**Result.**
- The userinfo is found only inside the authority.
- Query values outside a five-key allow-list, and the fragment, print as `***`.
- Secrets under 4 characters are scrubbed only as whole tokens.
- `openLog` refuses what doctor calls foreign or newer.

10 tests went from red to green. 1508 pass in `make test`.

**Consequence.** E0.4 awaits re-verification.

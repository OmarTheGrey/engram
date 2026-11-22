---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.15
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - scripts/test/tasks-and-decisions.test.ts
  - docs/decisions/README.md
supersedes: docs/log/2026-11-21-e8-15-failure-adr-index.md
---

**What.** After merging main at `1ecf4aa9`, which brought card E8.12's ADR 0042, `scripts/test/tasks-and-decisions.test.ts` still fails its consecutive-index check on this branch: the index lists 0042, then 0044.

**Why.** ADR 0043 belongs to card E8.13, which has not merged; the earlier entry named both 0042 and 0043 as missing, and 0042 has since landed.

**Result.** `pnpm exec vitest run --config scripts/vitest.config.ts scripts/test/tasks-and-decisions.test.ts`: 1 failed, 138 passed, the missing 0043. The merge kept both sides of the conflicts: items 60 and 62, the 0042 and 0044 rows, `OWNER_DECIDES` with 0034, 0042 and 0044.

**Consequence.** Merge E8.13 before this PR; the test then passes with no change here.

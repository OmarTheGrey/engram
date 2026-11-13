---
date: 2026-11-06
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - scripts/test/tasks-and-decisions.test.ts
  - docs/decisions/0033-shared-model-package.md
  - "pnpm exec vitest run scripts/test/tasks-and-decisions.test.ts"
supersedes: none
---

**What.** After ADR 0032 was added as proposed, the full suite failed one test: `scripts/test/tasks-and-decisions.test.ts`, "ADR 0032 is decided, has its own file and a decision log entry", with `expected 'proposed' not to match /^proposed/`.

**Why.** The test requires every ADR in the index to be decided, except those listed in `OWNER_DECIDES` for the lead to decide; only ADR 0031 was listed. A drafted ADR that the lead has not accepted is proposed by definition.

**Result.** ADR 0032 joined `OWNER_DECIDES`, as PR 3 of the pre-registration plan did for ADR 0031; the test passes, 102 tests.

**Consequence.** When the lead accepts or replaces ADR 0032, it leaves `OWNER_DECIDES` in the same PR.

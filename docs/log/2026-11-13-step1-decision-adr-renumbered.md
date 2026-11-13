---
date: 2026-11-13
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/decisions/0033-shared-model-package.md
  - docs/decisions/README.md
  - docs/decisions/0032-shared-model-package.md
  - "pnpm exec vitest run scripts/test/tasks-and-decisions.test.ts"
supersedes: docs/log/2026-11-06-step1-decision-model-package.md
---

**What.** The ADR for the shared model-call package, `@engram/model`, is renumbered from 0032 to 0033; its decision is unchanged and still proposed for the lead.

**Why.** Card E8.9's simulator PR (#28) was opened first with ADR 0032, so two PRs claimed the same number.

**Result.** The ADR file, its heading, the index row and every non-log citation (AGENTS.md, CLAUDE.md, the testing convention, the backlog, the cassette README, code comments) now say 0033. The index reserves row 0032 for E8.9, and the ADR test lists 0032 and 0033 as left for the lead. The old path holds a short pointer to 0033, because the 2026-11-06 entries cite it and are immutable.

**Consequence.** Merge #28 first, or keep its row 0032 when resolving the index conflict.

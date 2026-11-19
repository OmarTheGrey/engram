---
date: 2026-11-19
author: claude-agent
type: decision
card: L3
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/model.ts
  - packages/core/src/plane/lint.ts
  - docs/decisions/0017-cached-metered-seeded-model-calls.md
supersedes: docs/log/2026-11-19-l3-decision-usage-on-events.md
---

**What.** A model finding's lint event carries the call's usage, except when the finding's source is outside the linted scope, where it carries none.

**Why.** Review L3-2: the input tokens of an unsupported-claim call are the fixed prompt plus the claim plus the source, so on an event every member sees they tell the source's length, which ADR 0009's post-merge amendment forbids.

**Result.** Contradiction findings and in-scope unsupported-claim findings carry usage; the out-of-scope ones do not, and their usage stays in LintReport.judgments and usage.json (property in packages/core/test/property/lint-leak.test.ts).

**Consequence.** A cost ledger read from the log alone undercounts further; usage.json stays complete.

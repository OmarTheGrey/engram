---
date: 2026-11-21
author: claude-agent
type: decision
card: R2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/core/policies/medium.yaml
  - packages/core/src/policy/load.ts
  - packages/core/src/lint.ts
  - docs/tasks/L5.md
supersedes: none
---

**What.** The near-duplicate tier's switch is a deterministic lint of its own id, `near-duplicate-tier`, enabled only by listing it in `lints.enabled`. It is not a new policy field.

**Why.** The three registered presets already set `lints.thresholds.near-duplicate` (0.8, 0.85 and 0.9), so the threshold cannot be the switch. A new field would be a schema pull request. Lint ids are plain strings in the schema (`lints.enabled`, `LintFinding.lint_id`) and are validated in `load.ts`, so a new id needs no schema change. The id cannot be `near-duplicate`, because the loader refuses a lint id that is also a threshold key.

**Result.** No registered preset lists the id. P4 and card L5 now say so, and L5 must test that every registered preset's `duplicate` findings stay byte-identical.

**Consequence.** If `make api-check` shows the id list is generated, the id goes through card E2.8.

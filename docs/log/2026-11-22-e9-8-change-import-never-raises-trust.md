---
date: 2026-11-22
author: claude-agent
type: change
card: E9.8
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/portable.ts
  - packages/core/test/unit/portable-import.test.ts
  - "make test-one T=packages/core/test/unit/portable-import.test.ts"
  - "make test-one T=packages/cli/test/import-export.test.ts"
supersedes: docs/log/2026-11-21-e9-8-change-import-actor.md
---

**What.** An imported row's kind is the least trusted of what it claims and `import` (core's `importedWrite`), the import actor's source set to that kind per row; a row claiming `user` is recorded `import`.

**Why.** Review finding E9.8-1, the lead's fix: every row was recorded `import`, which ranks above tool, model, compaction and external, so a model or external row reached team scope as an import candidate.

**Result.** Under medium a model and an external row aimed at team:platform are denied (`preset.medium/write/team`); where the rule takes their kind, source isolation denies them; a model row lands in person scope as a model candidate with its model named; under strict a compaction row is refused (`preset.strict/write/person`). Recording every row `import` again fails 7 of 16 core tests (mutation check).

**Consequence.** The CLI keeps parsing and one client call per row (E9.8-4).

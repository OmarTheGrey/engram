---
date: 2026-11-21
author: claude-agent
type: change
card: E9.8
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/cli/src/import/bundle.ts
  - packages/cli/src/commands.ts
  - packages/cli/test/import-export.test.ts
  - "make test-one T=packages/cli/test/import-export.test.ts"
supersedes: none
---

**What.** `engram import <bundle>` makes every row one Plane.write by the dedicated import actor `import:<importer>`, source import, owned by the importer, status candidate, no grants, a new id, and prints the id map.

**Why.** Decision item 55 (a): nothing arrives trusted, so the gate decides each row.

**Result.** A transport test reads every write request: actor `import:person:dana` with source `import`, item status candidate, grants empty, version 1, though the row claimed kind user, status active, version 4 and a grant. Setting the import actor's source to `user` fails 2 of the 16 tests (mutation check). Under strict, the team row is denied (`preset.strict/write/team`) and the command exits 1.

**Consequence.** The CLI's `user` source for `engram write` is not inherited by an import.

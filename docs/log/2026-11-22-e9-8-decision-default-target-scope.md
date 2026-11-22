---
date: 2026-11-22
author: claude-agent
type: decision
card: E9.8
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/cli/src/commands.ts
  - packages/cli/test/import-export.test.ts
supersedes: none
---

**What.** A bundle row is written to its own scope unless `--scope` names one for every row; a pasted Claude list goes to the importer's person scope.

**Why.** The card did not say where rows land; a bundle names each row's scope, and a pasted list names none.

**Result.** The gate still decides each row in its target: the importer must be a member, and the target's rule must take the row's kind. `import --scope team:platform` writes all three fixture rows there.

**Consequence.** Moving rows between people is `--scope`, never an inferred mapping.

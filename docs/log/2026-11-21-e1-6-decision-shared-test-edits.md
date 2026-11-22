---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/db/schema-v1.test.ts
  - packages/cli/test/commands.test.ts
supersedes: none
---

**What.** Two existing tests were changed: schema-v1 now expects migration 4 and every later one, and the CLI help snapshot shows the log commands.

**Why.** Adding migration 5 makes `migrate` on a version 0 log return [4, 5]; a new command changes the help text the snapshot holds.

**Result.** Neither assertion was weakened: the migration list is computed from MIGRATIONS, the snapshot is the full new text. Card E8.12 makes the same schema-v1 change.

**Consequence.** A merge with E8.12 keeps one of the two identical forms.

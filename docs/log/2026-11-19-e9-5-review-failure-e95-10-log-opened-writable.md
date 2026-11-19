---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/scripts/dogfood-report.ts
  - packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** Review finding E95-10 (minor): the report opened the log through core's opener, which sets WAL mode, so pointing it at a SQLite file that is not a log converted that file.

**Why.** `openSqlite` is for the plane's own logs.

**Result.** The script opens the file with `new DatabaseSync(path, { readOnly: true })` and checks it holds `schema_migrations` and `events`. A test refuses a foreign SQLite file and finds its bytes unchanged, header byte 18 still 1; a mutant that sets WAL fails it.

**Consequence.** The report never writes the file it reads.

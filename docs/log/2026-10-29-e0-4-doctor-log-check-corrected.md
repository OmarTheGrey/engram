---
date: 2026-10-29
author: claude-agent
type: change
card: E0.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/doctor.ts
  - packages/cli/test/doctor-review.test.ts
supersedes: docs/log/2026-10-29-e0-4-doctor-and-dev-environment.md
---

**What.** This corrects the first E0.4 entry, which said doctor never creates a log. Until review P3 that held only for a missing SQLite file.

**Why.** Doctor opened any existing database through `openLog`, which runs `migrate`. It turned an empty file or another tool's database into an Engram log, and it applied pending migrations to an older one (review finding P3-3).

**Result.** Doctor now classifies the target without changing it:
- no log yet;
- not an Engram log, which fails;
- pending migrations, which it reports and leaves for the next read or write;
- newer than this Engram, which fails;
- up to date.

Tests on both backends show an empty file stays 0 bytes, a foreign database keeps exactly its tables, and an older log keeps its migration rows.

**Consequence.** The earlier entry's other claims stand.

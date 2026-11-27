---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15b
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/saved.ts
  - packages/cli/test/tui/saved.test.ts
supersedes: docs/log/2026-11-22-e8-15b-change-saved.md
---

**What.** A Postgres `--db` is never saved to tui.json, not even redacted, and one an older file holds is dropped on load; saving such a workspace says "not saved: contains credentials; set ENGRAM_DB_URL or re-enter it". This replaces the earlier entry's "saved redacted as doctor prints it".

**Why.** The lead's decision on review finding I5: a redacted URL parsed as a real one and beat ENGRAM_DB_URL on the next start.

**Result.** saved.test.ts: the file holds no Postgres URL, an old one is dropped, and ENGRAM_DB_URL is the log's source.

**Consequence.** A person with a Postgres log sets ENGRAM_DB_URL once.

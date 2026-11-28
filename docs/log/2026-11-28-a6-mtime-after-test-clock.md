---
date: 2026-11-28
author: claude-agent
type: failure
card: A6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/mcp-memory.test.ts
  - packages/cli/test/helpers.ts
supersedes: none
---

**What.** The first CLI test expected `engram read` to return the server's records and got none.

**Why.** An imported record's valid_from is the file's modification time unless `--import-valid-from` is given; the CLI tests' clock is fixed at 2026-10-25, before the file was written, so every record was not yet valid.

**Result.** With `--import-valid-from 2026-10-01T00:00:00Z` the read returns both records; the files store behaves alike.

**Consequence.** None in the adapter; a user reading at a past `--at` sees only records whose file was last written before it.

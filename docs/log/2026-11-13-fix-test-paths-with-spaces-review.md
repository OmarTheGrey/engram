---
date: 2026-11-13
author: claude-agent
type: finding
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/core/test/unit/schema.test.ts
  - packages/runner/test/retrieval.test.ts
  - "pnpm exec vitest run packages/core/test/unit/schema.test.ts packages/runner/test/retrieval.test.ts"
supersedes: none
---

**What.** A review of the space-in-path fix searched every package, script and test for other file URLs turned into paths by hand and found none left.

**Why.** A path built from `URL.pathname` keeps `%20` and a leading slash before a Windows drive letter, so any such site breaks on a checkout like the lead's.

**Result.** Every other `new URL(..., import.meta.url)` either goes through `fileURLToPath` or is handed to `node:fs` as a URL, which decodes it. The remaining `.pathname` uses are HTTP request URLs and a Postgres URL. The acceptance command passes, 2 files and 76 tests.

**Consequence.** Nothing; the branch merges as it is.

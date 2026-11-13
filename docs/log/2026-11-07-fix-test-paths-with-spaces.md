---
date: 2026-11-07
author: claude-agent
type: failure
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

**What.** `packages/core/test/unit/schema.test.ts` and `packages/runner/test/retrieval.test.ts` failed to load on a checkout whose path holds a space (`D:\Graduation Project\engram`), with ENOENT on `D:\Graduation%20Project\...`.

**Why.** Both turned a file URL into a path with `URL.pathname` and a drive-letter regex, which keeps percent-encoding, so a space stays `%20`. Every other test uses `fileURLToPath`.

**Result.** Both now use `fileURLToPath` from `node:url`, which decodes the URL and handles the Windows drive letter; the two files pass, 76 tests.

**Consequence.** A path from `import.meta.url` goes through `fileURLToPath`, never `pathname`.

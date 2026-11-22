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
  - packages/core/src/plane/export.ts
  - packages/cli/src/import/bundle.ts
  - packages/cli/src/import/claude.ts
  - packages/cli/test/import-export.test.ts
  - "make test-one T=packages/cli/test/import-export.test.ts"
supersedes: none
---

**What.** Card E9.8's review fix pass: an import never raises trust (E9.8-1), the row mapping moved into core (E9.8-4), duplicate item ids refused (E9.8-2), every export recorded (E9.8-3), fenced text only (E9.8-5), the owner question deferred (E9.8-6), and the minor findings.

**Why.** The review of the card found one critical, three important and several minor findings.

**Result.** The minor fixes: the dashes in the parser's regex written as escapes, a 64 MiB bound on bundle and pasted input (a sparse 64 MiB plus one byte file refused, exit 2), a future bracketed date replaced by the import time and reported, `import --scope` tested, `bundleRows`'s order described as id order. 2,559 tests pass across core unit, server, CLI, MCP and UI after the merge with E8.12.

**Consequence.** The entries this pass falsifies are superseded one by one.

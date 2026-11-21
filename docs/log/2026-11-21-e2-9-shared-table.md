---
date: 2026-11-21
author: claude-agent
type: change
card: E2.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/bypass.ts
  - packages/core/test/unit/plane/bypass.test.ts
supersedes: none
---

**What.** The redactor of `plane/bypass.ts` (card PX1, finding R7-9) now reads its six patterns from `SECRET_TABLE` in `policy/secrets.ts`, the table the guard reads, as entries with a `redact` replacement.

**Why.** ADR 0039, Consequences: the redactor and the guard share one table, so there is one list to maintain.

**Result.** Byte-identical output: `bypassAttempt` over 10,620 lines of the repository's own code and docs gave the same 513,526 bytes before and after the move, and the existing bypass, attack, CLI-block, interception and session-replay tests pass unchanged (87 tests). The six entries come first in the table, in their old order, and carry no guard rule.

**Consequence.** A pattern added to the table is used by whichever consumer its entry names.

---
date: 2026-10-29
author: claude-agent
type: change
card: E8.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
  - packages/core/test/unit/no-bypass.test.ts
  - docs/decisions/0014-no-bypass.md
supersedes: none
---

**What.** Fixes from the final verification of PR 3 (findings R3-16 to R3-18): quoted arguments checked word by word except version-control messages, PowerShell encoded commands decoded and checked, and two more out-of-reach cases stated.

**Why.** R3-15's quoted-argument rule reopened literal bypasses; `-EncodedCommand` hid a script from the text check; ADR 0014 did not list enclosing-folder commands.

**Result.** Eleven blocked cases and six passing message cases in `packages/core/test/unit/no-bypass.test.ts`; an encoded `Set-Location memory` is refused under four flag spellings, and an encoded `mem0` command names the store. Mutants: the R3-15 filter restored fails 9 tests, the message exemption removed 3, decoding off 1. Turning off the nested-script rule no longer fails a test, since every quoted word is now checked anyway; it stays so a message inside a script is read as a message.

**Consequence.** ADR 0014's amendment lists the costs and the enclosing-folder limit.

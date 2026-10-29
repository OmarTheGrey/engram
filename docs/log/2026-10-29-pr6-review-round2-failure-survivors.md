---
date: 2026-10-29
author: claude-agent
type: failure
card: PX1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/test/unit/bash.test.ts
  - packages/pi-extension/test/attacks.test.ts
supersedes: none
---

**What.** Two of the round-2 mutants survived the first set of tests: dropping the `$'...'` decoding in bash.ts, and dropping the tag defusing for non-message entries in the branch-summary handler.

**Why.** The per-word C-escape decoding already caught every `$'...'` store name, so only a path spelled in ANSI-C quoting depends on the decoding; and the branch-summary test carried a forged tag only in a user message, which the message path defuses.

**Result.** A pathWords test (`cat $'\x2ftmp...'`) and another extension's injected custom message in the branch-summary test now kill both mutants.

**Consequence.** Nothing further; the mutation list is in the round-2 report.

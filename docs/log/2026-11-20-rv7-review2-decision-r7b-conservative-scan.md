---
date: 2026-11-20
author: claude-agent
type: decision
card: RV7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
supersedes: none
---

**What.** The scan after a leading `cd` chain reads quotes, treats `2>&1`, `&>` and `|&` as no separator, and counts a backtick or `$(` inside double quotes as a separator.

**Why.** The finding allowed only `&&` and pipes. Commands like `cd src && grep -r x . 2>&1` are ordinary, while a substitution runs a script whose own `;` the quote scan cannot see.

**Result.** Unterminated quotes and escaped separators also count as separators, so the scan errs towards keeping the cwd.

**Consequence.** A few ordinary commands with a quoted substitution after a leading `cd` are judged in the cwd too, a cost of blocking too much rather than too little.

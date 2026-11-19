---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** The mutation runner, a Python script in the session's scratchpad, failed twice printing vitest's output: `UnicodeEncodeError` on the console's code page.

**Why.** `python -I` ignores `PYTHONIOENCODING`, so setting it did not help; each failed run restored the mutated file in its `finally`.

**Result.** The script now reconfigures its own stdout to UTF-8; all ten mutants then ran, each failing at least one test.

**Consequence.** Nothing beyond the fix.

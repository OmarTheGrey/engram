---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.11
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/crypto/keys.test.ts
supersedes: none
---

**What.** The first mutation check of the associated data did not apply: sed and then a Python replace missed the template literal's escaped NUL characters, so the suite passed against unmutated code.

**Why.** Shell quoting of backslash escapes inside a template literal.

**Result.** Redone with an exact file edit: three tests failed as expected, and the file was restored byte for byte.

**Consequence.** Mutations of escaped text go through the editor, not a shell.

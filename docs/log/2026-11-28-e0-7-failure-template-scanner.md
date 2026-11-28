---
date: 2026-11-28
author: claude-agent
type: failure
card: E0.7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - scripts/test/core-determinism-rule.test.ts
supersedes: none
---

**What.** The scanner's first version treated a template literal's opening backtick as its closing one, so template text was read as code.

**Why.** `templateText` began its scan at the backtick itself.

**Result.** The passing probe ``export const s = `Date.now() and ${1 + 1} new Date()`;`` failed with two findings; the scan now starts after the backtick, and a regex inside `${}` is read as a regex. 37 tests pass.

**Consequence.** The probes that seemed to pass for templates (`${Math.random()}`) passed for the wrong reason before the fix; each probe pair now has one refused and one passing form.

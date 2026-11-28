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

**What.** The mutation check of the core rule appended a probe line to `packages/core/src/explain.ts`, which does not exist, so it created that file instead of mutating one.

**Why.** The file name was guessed rather than listed first.

**Result.** The mutant still did its job (the rule failed with `src/explain.ts:1 Math.random` and `performance.now`), and the file was deleted at once; `git status` was clean of it before the next commit. The core project's full run had already finished.

**Consequence.** List the target before writing a probe into another package's tree.

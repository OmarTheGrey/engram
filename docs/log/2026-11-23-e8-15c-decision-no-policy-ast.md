---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/no-policy.test.ts
  - packages/cli/package.json
  - docs/deps.md
  - packages/view/src/view.ts
supersedes: none
---

**What.** The no-policy guard reads the TypeScript syntax tree: a reason, a policy id or an admitting rule may appear only as an argument of a display helper or in a template; every string literal, `+` chains folded, is checked for rule ids, presets and remedy wording. TypeScript 5.9.3, already locked for packages/server, is a dev dependency of packages/cli for the compiler API.

**Why.** Review finding 5: the word list let a branch on a reason, a policy id split and compared, a remedy sentence and a split preset name through. The native TypeScript 7 that `make lint` runs ships no compiler API (docs/deps.md row amended).

**Result.** The five survivors and the reviewer's other no-policy mutants fail it. The timeline's find moved to `@engram/view` (`findInReasons`).

**Consequence.** A new use of a reason goes through a display helper or `@engram/view`.

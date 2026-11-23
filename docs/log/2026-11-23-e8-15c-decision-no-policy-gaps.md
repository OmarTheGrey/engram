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
  - packages/cli/src/tui/screens/rich.ts
supersedes: docs/log/2026-11-23-e8-15c-decision-no-policy-ast.md
---

**What.** The syntax-tree guard, with the type checker over src/tui, also fails a destructured decision field, a member, call or comparison on drawn text, an answer read whole (JSON.stringify, Object.values, Object.entries) unless marked `no-policy: printer` or `not an answer`, and a computed key that folds to a decision field or reads an answer, through a cast too.

**Why.** Verification N2: five forms passed the first guard. An answer is told by its type: a decision field within four levels, or a run's body or request kept as unknown.

**Result.** Eleven probes, and real-source mutations of each form, fail it. A reason's first lines are drawn with a new helper, `firstLines`.

**Consequence.** TypeScript 5.9.3 stays a dev dependency of packages/cli.

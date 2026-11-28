---
date: 2026-11-28
author: claude-agent
type: decision
card: E0.7
chapter: design
pillar: plane
hypothesis: none
evidence:
  - scripts/test/core-determinism-rule.test.ts
supersedes: none
---

**What.** The rule refuses `Date` passed or bound as a value (after `=`, `(`, `,` or `?`, before `;`, `,` or `)`), and leaves a type alias `type D = Date;` and type positions alone.

**Why.** `const D = Date; D.now()` reaches the clock through a name the rule cannot follow; refusing the binding catches it at its source. Aliases of Math, performance, process or crypto are not refused, since `const { env } = process` and similar bindings are ordinary.

**Result.** Probes refuse `const D = Date;` and `make(Date)` and pass `Map<string, Date>`, `[string, Date]` and `type D = Date;`; the core tree has no such binding.

**Consequence.** If a core module ever needs the Date constructor as a value, it injects a clock instead.

---
date: 2026-11-28
author: claude-agent
type: failure
card: E0.7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - scripts/test/core-determinism-rule.test.ts
  - Makefile
supersedes: none
---

**What.** `biome check --error-on-warnings` (the first step of `make lint`) failed on the rule's test: two comma operators and six probe strings holding `${`.

**Why.** The probes are source text on purpose, and the bracket-class handling used comma expressions.

**Result.** The comma operators were rewritten as a block; each probe string carries a `biome-ignore lint/suspicious/noTemplateCurlyInString` comment saying it is probe text, as `packages/pi-extension/test/unit/bash.test.ts` does. Biome then reported no warnings on `scripts/test/`.

**Consequence.** Nothing.

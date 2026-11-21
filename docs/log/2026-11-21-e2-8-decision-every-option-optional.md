---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.8
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/schema.ts
  - packages/core/test/unit/policy/load.test.ts
supersedes: none
---

**What.** Every option inside `content_guards` and `trust` is optional too, absent meaning off; `max_content_bytes` is a positive integer, absent meaning no limit; the trust options take the strings `off` and `on`, as ADR 0040 names them, not booleans.

**Why.** ADRs 0039 and 0040 name the options and their values but not whether a block must state all of them. With no default anywhere, an option a policy leaves out has to mean today's behaviour, so making it optional is the reading that keeps "every default is off".

**Result.** `content_guards: {}` and `trust: {}` parse; an unknown value or option is rejected at its line (`packages/core/test/unit/policy/load.test.ts`, 7 new tests). In a document declaring YAML 1.1, an unquoted `on` is a boolean and is rejected; the default YAML 1.2 reads it as the string.

**Consequence.** Cards E2.9 to E2.11 treat an absent option as off.

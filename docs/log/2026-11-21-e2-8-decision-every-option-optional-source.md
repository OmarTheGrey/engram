---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.8
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/E2.8.md
  - packages/core/src/schema.ts
  - packages/core/test/unit/policy/load.test.ts
supersedes: docs/log/2026-11-21-e2-8-decision-every-option-optional.md
---

**What.** Every option inside `content_guards` and `trust` is optional, absent meaning off; `max_content_bytes` is a positive integer, absent meaning no limit; the trust options take the strings `off` and `on`, not booleans.

**Why.** The superseded entry said ADR 0040 names the values `off` and `on`. Card E2.8 names them (its step 1); ADR 0040 names the options only. ADRs 0039 and 0040 do not say whether a block must state every option, and with no default anywhere an option left out has to mean today's behaviour.

**Result.** `content_guards: {}` and `trust: {}` load. In a document declaring YAML 1.1, an unquoted `on` or `off` is a boolean: it is rejected at its line with a hint to quote the value. YAML 1.2, the default, reads it as the string.

**Consequence.** Cards E2.9 to E2.11 treat an absent option as off.

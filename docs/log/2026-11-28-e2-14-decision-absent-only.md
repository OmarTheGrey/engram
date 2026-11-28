---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.14
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/load.ts
  - packages/core/test/unit/policy/load-options.test.ts
supersedes: none
---

**What.** Until its card lands, every present value of an option is refused, `off` included, while an empty container (`lints.model: {}`, `procedures: {}`, `erasure: {}`, `grants: {}`) loads, since it holds every option absent.

**Why.** The card says absent is the only value the loader accepts, which is stricter than card E2.8's precedent of accepting `off`. An empty container sets nothing, and refusing it would make D5 and D4, who share `procedures`, rewrite a block-level rule instead of deleting their own rows.

**Result.** `NOT_BUILT_YET` in `policy/load.ts` lists one path per option with its card; `consent` and `approval` are refused as whole blocks, since their content is the option.

**Consequence.** If wrong, a later card accepts `off` by deleting its row; nothing registered sets any option.

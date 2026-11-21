---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/secrets.ts
  - packages/core/src/plane/bypass.ts
supersedes: none
---

**What.** The redactor's six patterns join the table as redact-only entries, and the redactor does not also apply the guard's rules.

**Why.** The card asks for one table and byte-identical redaction for every existing test and fixture; the pre-registration guard forbids changing what a registered condition does, and a bypass reason is shown to the model. Each of the six is also too broad to be a guard rule (`Bearer tokens` in prose, `://git@host`, any 32-character identifier).

**Result.** Identical output on 10,620 lines; the guard keeps its own URL and bearer rules.

**Consequence.** See the finding on the redactor's gaps; widening it is a later card's choice.

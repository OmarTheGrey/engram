---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.12
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/consent.ts
  - packages/core/test/unit/policy/consent.test.ts
  - packages/core/test/property/consent.test.ts
supersedes: none
---

**What.** The independent review found a bypass: `recordsContent` exempted every write with status retired, so a first write landing retired put covered content in the log and the store, and a same-content rewrite then made it active.

**Why.** The exemption tested the write's status, not the change; the oracle shared it and the generator never drew a retired first write or an un-retire.

**Result.** Only a same-scope, same-content rewrite making content no more live is exempt now. The oracle was rewritten from the rule's statement; the generator draws retired and candidate writes, changed retires, un-retires and candidates made active, each guarded; the probe is a regression test. The old exemption, and exempting candidate to active, both fail the property.

**Consequence.** Oracle independence must cover which writes count, not only how content matches.

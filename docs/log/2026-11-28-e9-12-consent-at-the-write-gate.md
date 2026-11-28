---
date: 2026-11-28
author: claude-agent
type: change
card: E9.12
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/consent.ts
  - packages/core/src/policy/evaluate.ts
supersedes: none
---

**What.** Built the `consent` option: `policy/consent.ts` evaluates a person's opt-outs (a topic, a provenance source, a window, carve-outs), and `evaluateWrite` denies a write an active opt-out covers under `engram/write/consent`.

**Why.** Card E9.12, Twin's first consent control; Incognito is an opt-out with only a window.

**Result.** A covered write is denied with check `consent`, after the identity, grant and trust checks and before the write rule, so it lands neither active nor as a candidate. Its reason names the opt-out by index and fields (`consent.opt_outs[0] of policy fixture.twin-consent (topic "health") covers this write to person:dana`), never the content; the denied event carries no item (plane/write.ts). Absent or empty, nothing changes: the property test checks an empty list decides every write as an absent block.

**Consequence.** The twin dogfood can declare opt-outs in its policy file.

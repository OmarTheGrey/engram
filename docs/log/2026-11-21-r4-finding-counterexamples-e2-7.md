---
date: 2026-11-21
author: claude-agent
type: finding
card: R4
chapter: limitations
pillar: govern
hypothesis: none
evidence:
  - packages/core/test/counterexamples/trust.test.ts
  - research/configs/crosswalk.json
supersedes: none
---

**What.** E2.7's characterisation tests, merged as `packages/core/test/counterexamples/trust.test.ts`, were read against every crosswalk claim.

**Why.** A test that pins a gap is evidence against a claim, not for it.

**Result.** None contradicts a claim as the crosswalk states it, but four needed their limits widened. C02: under a rule that admits its source, a co-member less trusted than an item's owner may rewrite, retire or evict that item (GH-38). C12: a sourceless write keeps its claimed kind and actor (GH-39). C13: content is model content only as a harness labels it. C18: a first write may carry grants, and with no source its claimed kind stands (GH-39). No characterisation test is named as evidence.

**Consequence.** When card E2.11's opt-in fix lands, these limits shrink under the policies that enable it.

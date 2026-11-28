---
date: 2026-11-28
author: claude-agent
type: finding
card: E2.18
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - research/results/h2-cedar-properties.json
  - packages/core/src/policy/cedar.ts
  - packages/core/test/property/cedar.test.ts
supersedes: none
---

**What.** What the proofs cover: the Cedar export of each preset, not evaluate.ts directly, and only modulo grants.

**Why.** A reader of the thesis must not take a proof of the export for a proof of the evaluator.

**Result.** The proofs hold for every request in the domain on exportCedar's text. They reach evaluate.ts through card E2.12's differential test, which samples agreement between the two, and its exclusions: the grant rules judged grant by grant are not exported, and grants are flattened, so the grant match and the class check are the encoder's. Content guards and trust options are off in the three presets, so nothing there is left out.

**Consequence.** A proof about grants themselves needs grants exported as sets, a future card. No counterexample was found on the card's three properties, so no fix card is opened.

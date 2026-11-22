---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.12
chapter: discussion
pillar: plane
hypothesis: none
evidence:
  - packages/core/policies/strict.yaml
  - packages/core/policies/medium.yaml
  - packages/core/policies/permissive.yaml
  - packages/core/test/property/cedar.test.ts
supersedes: none
---

**What.** Under strict, medium and permissive, the source-isolation rule (`engram/write/source-isolation`) never decides a write: no preset allows a model, compaction or external source outside person scope, so the allowed-sources check refuses it first.

**Why.** The differential test's coverage guard first required isolation to decide on the presets and failed with 0 such writes in 4,500.

**Result.** The rule is defence in depth on the presets; it decides only under a policy that lists an untrusted source for a shared scope, which generated policies reach. In Cedar both forbids hold, so the policy set names both.

**Consequence.** A registered number about write denials by reason will show isolation at zero under every preset; that is by construction, not a gap.

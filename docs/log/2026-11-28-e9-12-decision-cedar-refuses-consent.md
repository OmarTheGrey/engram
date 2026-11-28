---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.12
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/cedar.ts
  - docs/decisions/0041-cedar-export-for-analysis.md
supersedes: none
---

**What.** exportCedar refuses a policy that declares an opt-out, with a reason, and exports an empty `opt_outs` exactly as an absent block.

**Why.** ADR 0041: export faithfully or refuse. Topic matching is a loop over the content's words, which Cedar's language cannot express; flattening it into a request attribute would be the encoder deciding, which tests nothing, as for content guards.

**Result.** Unit tests: a declared opt-out throws CedarExportError naming consent; `exportCedar({...medium, consent: {opt_outs: []}})` equals `exportCedar(medium)`.

**Consequence.** Cedar analysis stays available for every registered preset; a policy with opt-outs is analysed without them only by removing them.

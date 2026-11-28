---
date: 2026-11-28
author: claude-agent
type: decision
card: L9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/cedar.ts
  - docs/decisions/0041-cedar-export-for-analysis.md
supersedes: none
---

**What.** `exportCedar` exports a policy with `lints.model.evidence` set, faithfully, rather than refusing it.

**Why.** The Cedar export states the read and write gates (ADR 0041); a lint decides no read or write, and `lints.enabled` and `lints.thresholds` were never exported either. Refusing would block the export of a policy whose gate Cedar states exactly. The alternative, refusing like content guards, applies to options that change a gate decision, which this one does not.

**Result.** cedar.ts's list of what is not exported names the lints, this option included; a test shows the export is identical with the option on, off or absent.

**Consequence.** If a later card makes a lint gate a write, the export must then translate or refuse it.

---
date: 2026-11-28
author: claude-agent
type: decision
card: D5
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/cedar.ts
  - docs/decisions/0041-cedar-export-for-analysis.md
supersedes: none
---

**What.** `exportCedar` exports a policy setting `procedures.safety_scan` as if the option were absent, and its header says so.

**Why.** The option acts only on the promotion gate's admission of a procedural item, which the export does not model; its read and write gates are the same with the scan off, report or hold, so ignoring it is faithful, where refusing would block exporting a policy whose exported gates are exact.

**Result.** A test pins that the export of medium with each mode equals medium's.

**Consequence.** If the export ever models promotion, it must translate or refuse the option.

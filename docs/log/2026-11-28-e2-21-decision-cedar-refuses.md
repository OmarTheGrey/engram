---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.21
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/cedar.ts
  - packages/core/test/unit/policy/load-options.test.ts
  - docs/decisions/0041-cedar-export-for-analysis.md
supersedes: none
---

**What.** The Cedar export takes `grants.expiry_cap: "off"` (its text equals the preset's without it) and keeps refusing `"on"`, with its own reason instead of "not built yet".

**Why.** ADR 0041, decision 5: the export refuses what it cannot translate faithfully. The cap and the first-write rule judge a write's grants one by one against the event's time, the class of write-path grant rules the export already leaves out because Cedar has no quantifier over a set; flattening the verdict into the request would have the encoder decide, which tests nothing.

**Result.** `exportCedar` throws `CedarExportError` naming `grants.expiry_cap` and "grant by grant"; a test pins both sides. No surface exports Cedar today, so the twin and knowledge profiles lose nothing in use.

**Consequence.** Exporting either profile to Cedar needs the option off, or a later card that encodes the per-grant verdict.

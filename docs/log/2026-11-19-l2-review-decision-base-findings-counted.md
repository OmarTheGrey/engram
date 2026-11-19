---
date: 2026-11-19
author: claude-agent
type: decision
card: L2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/bench/scripts/fault-set-check.ts
supersedes: none
---

**What.** The label check tells a base item from an injected one by its provenance ref: B5's turns cite `longmemeval:session/...`, which the generator never writes. A finding on a base item is counted per lint and listed, never failed; a finding on an injected item fails the check unless a label expects that lint on that item (`finding_on`).

**Why.** Review findings L2-1 and L2-2: failing on every unlabelled finding made precision on natural memory unmeasurable, while ignoring duplicates let a duplicated near-miss through.

**Result.** The result's `label_check.unlabelled_findings_on_base_items` holds the per-lint counts; the findings themselves go to `base-findings.jsonl` in the set, for the audit sample.

**Consequence.** L4 reports precision on the labelled set and, separately, with base-item findings as unverified.

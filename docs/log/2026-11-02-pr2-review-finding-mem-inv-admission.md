---
date: 2026-11-02
author: claude-agent
type: finding
card: R1
chapter: discussion
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-mem-inv-admission.json
  - docs/log/2026-10-29-b4-plane-gates-memory-not-action.md
supersedes: docs/log/2026-11-02-pr2-finding-mem-inv-admission.md
---

**What.** On MEM-INV-Bench the preset decides whether C5 has any write-side defence, and strict's defence comes from reading no shared record at all.

**Why.** The plane's decision depends only on an entry's channel, its inputs and the preset, so the vendored shares hold per channel for the whole benchmark.

**Result.** Under medium, the default C5 preset, 20 of 20 attacks reach the model's context, so a C4 minus C5 difference could come only from how the model reads provenance. Under strict, 15 of 20 wait as review candidates and the self-summary passes; but every `team:operations` entry waits too, the trusted ERP and bank filler and all 4 benign values included, so the operator acts on no shared record (`research/results/h1-mem-inv-admission.json`).

**Consequence.** For PR 4's sheet, not decided here: medium tests only the model; strict tests admission by withholding all shared memory.

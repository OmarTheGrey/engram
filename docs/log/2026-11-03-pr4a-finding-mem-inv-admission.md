---
date: 2026-11-03
author: claude-agent
type: finding
card: R1
chapter: discussion
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-mem-inv-admission.json
  - docs/log/2026-10-29-b4-plane-gates-memory-not-action.md
supersedes: docs/log/2026-11-02-pr2-review-finding-mem-inv-admission.md
---

**What.** On H1's full MEM-INV-Bench set the preset still decides whether C5 has any write-side defence, and strict's defence still comes from reading no shared record.

**Why.** The subset's shares were expected to hold per channel; the full set checks it on every scenario and channel.

**Result.** Under medium, H1's preset, 32 of 32 attacks reach the model's context, so a C4 minus C5 difference on this arm can come only from how the model reads provenance. Under strict, 24 of 32 wait as review candidates and the 8 self-summaries pass, but all 78 `team:operations` entries wait too, the trusted filler and the 6 benign values included (`research/results/h1-mem-inv-admission.json`).

**Consequence.** For part B's decision sheet, unchanged in substance: medium tests only the model; strict tests admission by withholding all shared memory.

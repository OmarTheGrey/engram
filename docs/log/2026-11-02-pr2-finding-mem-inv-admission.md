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
  - docs/decisions/0029-poisoning-arm-mem-inv-bench.md
supersedes: none
---

**What.** On MEM-INV-Bench the preset decides whether C5 has any write-side defence: medium and permissive admit every poisoned channel; strict keeps three of four out, and every benign value with them.

**Why.** The plane's decision depends only on an entry's channel, its inputs and the preset, so the vendored shares hold per channel for the whole benchmark.

**Result.** Under medium, the default C5 preset, 20 of 20 attacks reach the model's context, so a C4 minus C5 difference on this arm could come only from how the model reads provenance. Under strict, 15 of 20 wait as review candidates, the self-summary passes, and 0 of 4 benign values reach the read (`research/results/h1-mem-inv-admission.json`).

**Consequence.** For PR 4's decision sheet, not decided here: medium matches GateMem's preset but tests only the model; strict tests admission at a utility cost, and its review queue needs a stated reviewer in the protocol.

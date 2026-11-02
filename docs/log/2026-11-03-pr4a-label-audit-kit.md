---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/scripts/label_audit_sample.py
  - research/scripts/label_audit_agreement.py
  - research/configs/label-audit.json
  - research/tests/test_label_audit.py
  - docs/research/label-audit.md
supersedes: none
---

**What.** The label-audit kit: a seeded sampler that writes one sheet per H1 benchmark and member under `.engram/audit/`, and a script that turns two filled sheets into disagreement rates and Cohen's kappa.

**Why.** Plan decision 9: v1 requires 50 items per benchmark audited by two members before any run (ADR 0015); the kit prepares it, the members do it.

**Result.** A real draw gives GateMem 25 access-control and 25 forgetting checkpoints (labels: 25 `no_memory`, 14 `refuse`, 11 `answer_redacted`) and all 38 MEM-INV-Bench cases, each with a context file. The sampler writes only under `.engram/` or outside the repository and never overwrites a sheet. Tests: seeding and stratification, the full MEM-INV-Bench draw, and two synthetic filled sheets giving 2 of 10 disagreements and kappa 0.6 by hand; mutants dropping the chance correction or the seed are killed.

**Consequence.** `docs/research/label-audit.md` is the how-to; part B cites it in v1.

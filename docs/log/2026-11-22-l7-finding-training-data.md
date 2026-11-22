---
date: 2026-11-22
author: claude-agent
type: finding
card: L7
chapter: related-work
pillar: research
hypothesis: H3
evidence:
  - docs/deps.md
  - docs/readings/litreview/repo-nli-onnx-stack.md
supersedes: none
---

**What.** Checked the training data licence of cross-encoder/nli-deberta-v3-small, as card R2's proposal asks.

**Why.** P3 rules out a model trained on non-commercial data such as ANLI.

**Result.** The model card at fa2804872c3b names SNLI and MultiNLI only, Apache-2.0, base microsoft/deberta-v3-small (MIT). stanfordnlp/snli at cdb5c3d5 is CC-BY-SA-4.0; nyu-mll/multi_nli at da70db2a is mostly OANC's permissive licence, with fiction under CC-BY-SA-3.0, CC-BY-3.0 or public domain. No non-commercial licence appears.

**Consequence.** The model is usable under P3. The thesis states the training data. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.

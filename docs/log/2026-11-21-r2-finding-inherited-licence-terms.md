---
date: 2026-11-21
author: claude-agent
type: finding
card: R2
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - docs/research/preregistration.md
  - https://github.com/landian60/StreamMemBench
  - https://github.com/bowen-upenn/PersonaMem
  - https://huggingface.co/datasets/deepset/prompt-injections
  - https://github.com/deeplethe/lethe
supersedes: none
---

**What.** Several benchmarks with a permissive top-level licence inherit restricted terms, or state their terms inconsistently.

**Why.** The intake note lists only licences checked at the source, and the top-level licence is not the whole answer.

**Result.** AgentMemBench is unreleased and built on LoCoMo (CC-BY-NC-4.0). StreamMemBench is MIT, but it derives from EgoLife, whose repository licence allows only non-commercial redistribution. PersonaMem is MIT, but it is generated from PersonaHub (CC-BY-NC-SA-4.0). MemDerive's evaluator carries a CC-BY-NC judge prompt. deepset's card states both apache-2.0 and cc-by-4.0, which are both admissible. lethe gives its adversarial ForgetEval set as 385 cases in its README and 112 in its own doc.

**Consequence.** Any card that pins one of these resolves the term first. lethe's count is read at the pin.

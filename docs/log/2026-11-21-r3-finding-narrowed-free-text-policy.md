---
date: 2026-11-21
author: claude-agent
type: finding
card: R3
chapter: related-work
pillar: plane
hypothesis: none
evidence:
  - docs/research/positioning.md
  - docs/decisions/0006-scope-owner-grants-typed-policy.md
  - https://arxiv.org/abs/2611.20144
  - https://arxiv.org/abs/2610.22959
supersedes: none
---

**What.** "Their policies are free text read by a model; ours are typed and evaluated by code", the absorb plan's wording for R3, is narrowed.

**Why.** HEAMS's framework has deterministic substring and metadata rules and a hybrid mode beside the LLM mode (Sec. 4.2; `_rule_matches` in `retention_policy_deterministic.py`); only its reported experiments all use free text read by gpt-4o-mini (Appendix D.2). SAFE-Mem's gate is a comparison in code (Eq. 2; `_admits` in `typed.py`), but over labels a model partly sets: the kind at extraction and the use a request needs (prompts Q.1 and Q.4).

**Result.** The difference that holds: in Engram no model sets any input to a decision or makes one (AGENTS.md rule 4; ADR 0006). Provenance kind comes from the harness (ADR 0004, decision D4).

**Consequence.** `docs/research/positioning.md` states each system's policy form exactly.

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
  - packages/pi-extension/src/tools.ts
  - packages/core/src/policy/evaluate.ts
  - https://arxiv.org/abs/2611.20144
  - https://arxiv.org/abs/2610.22959
supersedes: docs/log/2026-11-21-r3-finding-narrowed-free-text-policy.md
---

**What.** "Their policies are free text read by a model; ours are typed and evaluated by code", the absorb plan's wording for R3, is narrowed.

**Why.** HEAMS also has deterministic and hybrid modes (Sec. 4.2; `_rule_matches`); only its reported experiments all use free text read by gpt-4o-mini (Appendix D.2). SAFE-Mem's gate is code (Eq. 2; `_admits`) over labels a model partly sets (prompts Q.1 and Q.4).

**Result.** In Engram no model makes a decision or sets a trust-bearing input: the provenance kind and the actor come from the harness (ADR 0004, D4), the fields the writing agent chooses (scope, class, confidence; `memory_write` in `packages/pi-extension/src/tools.ts`) are checked by the gate against the policy (`forbidden_classes`, `confidence_floor` in `evaluateWrite`), and no model classifies the request at read time.

**Consequence.** Supersedes the first version, whose "no model sets any input to a decision" was false (review finding R3-1).

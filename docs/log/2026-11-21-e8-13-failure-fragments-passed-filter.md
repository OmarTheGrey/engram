---
date: 2026-11-21
author: claude-agent
type: failure
card: E8.13
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/export/otel.ts
  - docs/decisions/0043-decision-export-egress.md
supersedes: none
---

**What.** Review finding E8.13-1 (critical): the reason filter split free text at `; ` and kept any fragment that matched a template, so `engram hook claude-code --export-jsonl` on the Bash command `mem0 add note; it targets person:zebra-quartz-7731` exported `[withheld]; it targets person:zebra-quartz-7731`.

**Why.** The slots of SCOPE, PRINCIPAL, POLICY and N admit most short tokens, and the filter judged every clause on its own, including those after free text. The content-free test planted the secret only in clauses no template could match.

**Result.** The review's reproduction gave `grep -c zebra` 1. It also leaked through `Plane.recordBypass` (`policy <secret>+x has no write rule for org`, `returned 41111111 of 2 candidates`) and a model-lint reason. No registered run is affected: no registered config names a sink.

**Consequence.** Fixed in the review pass (the change entry of that pass).

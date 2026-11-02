---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/decisions/0031-c1-and-c4-on-each-benchmark.md
  - packages/runner/src/gatemem-probe.ts
supersedes: none
---

**What.** On GateMem, C4 shows every retrieved item with the RAG-Policy gate's verdict as an `access` attribute, beside the speaker and role, and the model decides; nothing is filtered.

**Why.** Ported as upstream runs it, the gate would filter before the model, which is C5's mechanism, and C4 minus C5 would compare two enforcers. The Conditions table says the model decides from the metadata; this is the closest port that keeps H1's contrast.

**Result.** Recorded in ADR 0031 (proposed), with the filter, the verdict-free metadata and Engram's own facts as alternatives and the one-branch cost of each.

**Consequence.** The lead accepts or changes it before `prereg-v1`; if changed, C4's cassettes are recorded again by `make fixtures`.

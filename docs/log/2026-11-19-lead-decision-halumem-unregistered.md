---
date: 2026-11-19
author: omar
type: decision
card: B8
chapter: design
pillar: research
hypothesis: H3
evidence:
  - docs/readings/litreview/2511.03506-halumem.md
  - packages/bench/PINS.md
  - docs/log/2026-11-19-halumem-release-check.md
supersedes: none
---

**What.** The lead first chose to register HaluMem for H3 before the tag, then, after its release check, decided it stays a proposed amendment, unregistered.

**Why.** The release check of 2026-11-19 found CC-BY-NC-ND-4.0 on HaluMem's code and its data (`docs/log/2026-11-19-halumem-release-check.md`): NoDerivatives forbids the committed adapted fixture subset and ported judge every pinned benchmark here has, and NonCommercial conflicts with the repository's Apache-2.0 licence (ADR 0020).

**Result.** HaluMem is a row of the candidates table in `packages/bench/PINS.md`, not pinned. v1's "Proposed amendments, not yet registered" says so; its Benchmarks table and H3 are unchanged. Cards B8 and X10 note that their HaluMem work waits.

**Consequence.** H3 stays on the benchmarks v1 registers; HaluMem returns only by a later decision and an amendment.

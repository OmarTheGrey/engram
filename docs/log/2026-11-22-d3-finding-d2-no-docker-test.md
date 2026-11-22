---
date: 2026-11-22
author: claude-agent
type: finding
card: D3
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - scripts/test/no-docker.test.ts
  - packages/core/test/unit/distill/skill-spec/cases.json
  - "pnpm exec vitest run --project scripts"
supersedes: none
---

**What.** After D2's branch and origin/main at d763deaa were merged into card D3's branch, `pnpm exec vitest run --project scripts` gives 191 passed and 1 failed. The "ADRs consecutively" test passes. The failure is "no test source, script or vitest config calls a container runtime".

**Why.** Card D2's fixture `packages/core/test/unit/distill/skill-spec/cases.json` has a case whose text reads "Requires git, docker, jq". The no-Docker test's pattern matches it. The test and the file are both on D2's branch, so D2 fails it without D3.

**Result.** D3 leaves the file as it is. It is D2's, and its goldens come from the Agent Skills validator.

**Consequence.** For card D2: reword the case or exempt the golden set, before D2 merges.

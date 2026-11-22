---
date: 2026-11-21
author: claude-agent
type: decision
card: L5
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - packages/core/src/lint/near-duplicate.ts
  - packages/core/scripts/near-duplicate-pairs.ts
  - packages/core/scripts/faults.ts
supersedes: none
---

**What.** The tier lives in a new file, packages/core/src/lint/near-duplicate.ts, called from det.ts, and the research script's pairs come from a new core script, near-duplicate-pairs.ts; the card names only det.ts and the research files.

**Why.** Ported code needs a file whose header names the sources; the Python script must not reimplement the lint, so a TypeScript entry writes the shingles, as card L4's lint-fault-set.ts does.

**Result.** Both stay inside packages/core; no other package is touched. Load.ts gains the threshold check.

**Consequence.** Nothing else.

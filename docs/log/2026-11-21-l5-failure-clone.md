---
date: 2026-11-21
author: claude-agent
type: failure
card: L5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/absorbed.md
supersedes: none
---

**What.** A shallow clone of DeusData/codebase-memory-mcp failed with "fetch-pack: invalid index-pack output".

**Why.** The repository is large and the machine was loaded.

**Result.** A blobless sparse clone of LICENSE and src/simhash/ at 1111d9a9 worked.

**Consequence.** Nothing.

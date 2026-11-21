---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/absorbed.md
supersedes: none
---

**What.** A shallow clone of joshuaswarren/remnic failed with `fetch-pack: invalid index-pack output`.

**Why.** The source must be read at a commit (ADR 0037).

**Result.** A blobless sparse clone took only the licence and `injection-screen.ts` with its test, at commit ce22909cc219e36d0e31b1158a4ab74f175008a0.

**Consequence.** None.

---
date: 2026-11-28
author: claude-agent
type: failure
card: D4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/configs/crosswalk.json
  - packages/core/test/unit/policy/load-options.test.ts
supersedes: none
---

**What.** Three small dead ends while editing: bash heredocs holding quotes broke twice (as the brief warns), a scripted string replacement in `load-options.test.ts` matched nothing, and the crosswalk refused the first wording of C48.

**Why.** The heredocs ended early on an apostrophe; the replacement's escapes did not match the file's text; the crosswalk's wording check read "meets" in C48 as a compliance claim ("a row bears on an obligation, never meets it").

**Result.** Files were written with the editor tools instead, the two rows were removed by exact edits, and C48 now says the procedure "passes the admission rule". The crosswalk then printed 51 claims, 48 evidenced.

**Consequence.** None beyond the fixes.

---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.16
chapter: design
pillar: govern
hypothesis: none
evidence:
  - packages/cli/src/audit.ts
  - packages/core/src/audit/ropa.ts
supersedes: none
---

**What.** `audit ropa` counts items only from a log `--db` names explicitly, never from ENGRAM_DB_URL or the default log, and lists Article 30(1) points (a), (b) and (e) as not held.

**Why.** The card says the record comes from the policy's scopes and classes; counts are an addition, so they appear only when asked for, and a policy cannot state the controller, the purposes or the transfers.

**Result.** Without --db the record is the policy's alone and has no time in it, so it is the same bytes for the same policy.

**Consequence.** nothing

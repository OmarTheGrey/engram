---
date: 2026-10-29
author: claude-agent
type: decision
card: A2
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0028-letta-adapter-over-memfs.md
  - packages/cli/src/doctor.ts
supersedes: docs/log/2026-10-29-a2-memfs-open-choices.md
---

**What.** The review fix pass of PR #20 corrected and added Letta adapter choices in ADR 0028's amendments: intent-to-add staging with `git commit --only`, "already stored" decided against HEAD, commits refused in six repository states, nested repositories refused, `.git` pointer files opened, `index.lock` refusals retried for two seconds, a 300 s stale age, and doctor making three direct adapter calls (`history`, `delete`, `read`), not one.

**Why.** The earlier entry said doctor's delete was its only direct call (review finding R2-7) and the ADR contradicted the code on nested folders (R2-8).

**Result.** The ADR's Opening, Commits, All or nothing, Lock and Doctor amendments now match the code and tests.

**Consequence.** This entry replaces the earlier decision entry for these points.

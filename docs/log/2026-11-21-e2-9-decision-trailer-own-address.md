---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/secrets.ts
  - packages/core/test/unit/policy/secrets.test.ts
supersedes: docs/log/2026-11-21-e2-9-decision-trailers.md
---

**What.** Only the address a git trailer itself names is exempt: a line starting with the trailer's word within 128 characters, then a name, then `<address>` closing the line.

**Why.** The superseded rule exempted every email on a line starting with a trailer word, and looked 1,024 characters back for it, so "Author: ... customer jane.doe@gmail.com" and "Reported-by: customer ..." passed (V-3b).

**Result.** Those two, a trailer word 300 characters back, and an address after a trailer's own are all held; `Signed-off-by: Dana Kim <dana@example.org>` and `Co-Authored-By: Claude <...>` are not.

**Consequence.** A trailer-shaped line names any address it likes; listed in the result's limits.

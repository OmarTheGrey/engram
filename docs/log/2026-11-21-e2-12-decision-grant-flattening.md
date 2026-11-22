---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.12
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/cedar.ts
  - packages/core/test/property/cedar.test.ts
supersedes: none
---

**What.** "Grants are flattened at export" (ADR 0041, decision 5) is read as: on a read, the request carries, for the reader alone, the latest expiry among the item's grants whose `to` matches the reader and whose class is absent or the item's; on a write, grants are not exported and every generated write carries none.

**Why.** Cedar cannot quantify over a set, so it cannot judge each grant of a list. A live grant exists exactly when the latest expiry of the matching grants is after the read time, so one optional record suffices. The write path's grant rules judge strings and multisets of grants.

**Result.** Cedar still judges `honour_grants`, the expiry against the read time and scope's precedence over grant; the pattern match and the class are the encoder's (`grantMatches`). The test names five excluded or flattened classes.

**Consequence.** Agreement holds modulo grants, as the ADR states.

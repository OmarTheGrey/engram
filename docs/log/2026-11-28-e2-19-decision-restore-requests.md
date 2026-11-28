---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.19
chapter: design
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/plane/revalidate.ts
  - packages/core/src/plane/approvals.ts
supersedes: none
---

**What.** A drift restore's ask opens a `restore` request; an approver the route names restores by presenting the replay with `review` to Plane.revalidate (a new option); a new presentation replaces an open restore request, and expiry or refusal never closes the version.

**Why.** Finding F4: the request was on a retired item nobody could approve, and its expiry stranded the procedure for good.

**Result.** Unit tests: an unrouted presenter is refused, a routed one restores, an expired request is followed by a fresh one.

**Consequence.** D4's revalidate gains one optional field; a finding for D4 and E8.8.

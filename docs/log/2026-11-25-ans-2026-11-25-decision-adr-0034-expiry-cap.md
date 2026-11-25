---
date: 2026-11-25
author: claude-agent
type: decision
card: ANS-2026-11-25
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
  - docs/tasks/lead-decisions.md
  - docs/tasks/backlog.md
supersedes: none
---

**What.** ADR 0034's decisions 3 and 6 now fix what the one-year cap means, so card E2.21 builds one rule.

**Why.** Review finding ANS2-6: "one year", its rule id and its reach were undefined. The orchestrator settled them.

**Result.** One year is 365 days, 31,536,000 seconds, after the write's or grant change's event time from the injected clock. A longer expiry is refused, never clamped, under `engram/write/grant-expiry-cap`, and the reason names the limit; exactly 365 days is accepted. The cap and the expiry check apply to every grant on a first write and to every grant added by a grant change, on `Plane.write` and `Plane.changeGrants` alike; a kept grant is not judged again. A promotion's new version is exempt, since it only keeps grants an earlier write already held to the rule.

**Consequence.** Card E2.21 builds it as written. Review finding ANS2-9 corrected an earlier reading that re-judged kept grants.

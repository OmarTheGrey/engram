---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.21
chapter: evaluation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - packages/core/test/unit/dogfood-report.test.ts
  - docs/dogfood.md
  - make test-one T=packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** The dogfood report counts a grant the cap or the first-write rule refuses under `watch.expiry_cap`, named in `--detail`, never as a violation; the format becomes `engram-dogfood-report/4`.

**Why.** The report replays a log under the twin profile, which now sets the option. The log does not record which policy the plane ran, so a grant a member wrote before part 2, lawful then, would read as a plane violation and exit 1. The plane's own cap is held by invariant 2 and the unit tests.

**Result.** Two planted events (a grant change to 2028, a first write with an expired grant) give `watch.expiry_cap` 2 and no new violation; without the option, 0; the two-week log, 0. `engram/write/grant-expiry-cap` joins the fixed rule list. 51 passed.

**Consequence.** A non-zero count on a log written after this card is a finding for the lead, as `docs/dogfood.md` now says.

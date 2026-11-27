---
date: 2026-11-25
author: claude-agent
type: finding
card: E2.21
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - packages/bench/src/gatemem/plane.ts
  - packages/runner/src/research/gatemem-reach.ts
  - research/results/h1-gatemem-reach.json
  - research/results/MANIFEST.md
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
supersedes: none
---

**What.** Before building ADR 0034's one-year cap and first-write rule, the pre-registration guard's survey of who writes grants on a first write.

**Why.** No registered result or cassette may move before `prereg-v1`.

**Result.** GateMem's mapping gives every unrestricted relationship without an end the grant expiry `OPEN_END`, `9999-12-31T23:59:59Z`, and every turn is a first write through `Plane.write`. A read-only count with the bench's own `mapCheckpoint`: on the fixture subset, 1,633 of 2,490 turn writes carry grants beyond a year (all 20 checkpoints); on the full pinned set (commit `a983828b`, 8 of 8 files matching), 197,143 of 325,530 (2,053 of 2,218 checkpoints). None is expired or of another class. The rule would refuse each. `h1-gatemem-reach.json` (sha256 `9607555c...`) records `denied_writes` 0 and `reachable_granted` 466, so its bytes move, as would C5's GateMem prompts and cassettes. Unregistered: `fixtures/profiles/twin-reads.json` writes an expired grant.

**Consequence.** Stopped before coding; the lead decides.

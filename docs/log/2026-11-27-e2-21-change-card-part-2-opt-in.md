---
date: 2026-11-27
author: claude-agent
type: change
card: E2.21
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/tasks/E2.21.md
  - fixtures/profiles/twin-reads.json
  - packages/core/test/unit/profiles/twin.test.ts
  - docs/log/2026-11-25-ans-2026-11-25-decision-grant-cap-opt-in.md
supersedes: none
---

**What.** Part 2 of the card follows the lead's answer (review finding E221-3); part 1's wording and a line range fixed (E221-2, E221-5).

**Why.** The card left the profiles unset and deferred `twin-reads.json`, a question the lead had closed.

**Result.** Step 1 names `grants.expiry_cap`, lifts E2.14's loader refusal and sets it in `twin.yaml` and `knowledge.yaml`. Step 7 settles write 4: it takes its own earlier write time, lands with a live grant, and the reads at the fixture's `at` still find it expired; the first-write refusal gets its own test. It lists the 23 test files and the dogfood report that load either profile, and the read filter tests seeding other-class or expired grants under `testPolicy()` (option absent). Part 2's acceptance adds `twin.test.ts` with the option on; step 2's reason names the expiry; step 5 cites lines 136 to 153.

**Consequence.** Part 2 starts from the lead's answer.

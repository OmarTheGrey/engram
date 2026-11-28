---
date: 2026-11-28
author: claude-agent
type: decision
card: L9
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/lint-faults.ts
  - research/configs/l9-grounding-fixture.json
  - fixtures/lint/l9-script.json
  - Makefile
supersedes: none
---

**What.** The grounded fixture run is card L3's four model fault fixtures under a runner config field `evidence: "on"` (`withEvidence` sets the option on each fixture's policy), with its own script and cassettes in `fixtures/cassettes/l9-grounding-fixture`, recorded by `make fixtures` (RUNNER_FIXTURES).

**Why.** The card lists `fixtures/faults/model/` and `fixtures/cassettes/l9-grounding/`. New fault fixtures there would join card L3's and the pilot's `items: "all"` and move their counts and outputs, against the guard; and `make fixtures` deletes the cassette folder named after the config before recording, so a folder of another name would keep stale cassettes. Hence no new fixture file, one runner field outside the card's files, and the folder named after the config.

**Result.** `make run CONFIG=research/configs/l9-grounding-fixture.json`: "model calls: 0 new, 51 from cassettes".

**Consequence.** None for registered configs: none sets the field.

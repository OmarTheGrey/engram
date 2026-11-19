---
date: 2026-11-19
author: claude-agent
type: milestone
card: L4
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - research/configs/h3-lint-delta-fixture.json
  - research/configs/h3-lint-model-fixture.json
  - fixtures/cassettes/h3-lint-model-fixture
  - "make h3-lint-delta FIXTURE=1"
supersedes: none
---

**What.** The model-based delta's pipeline, proven on a replay of the fixture set from committed scripted cassettes.

**Why.** The plan builds the delta now and runs it live once the key exists; its fixture numbers are never a result.

**Result.** Two fixture states at seeds 1 and 2 replay 250 calls from cassettes with zero new ones. The planted answers come out as planned: at seed 1 both supersessions are missed (stale delta 0) and one unlabelled pair is flagged (one unverified finding); at seed 2 both are found (stale delta 1/3), both conflict near-misses are flagged, one conflict reply is malformed and one claim refused. Writing a scripted run under research/results is refused.

**Consequence.** `make h3-lint-delta` gives the live delta after the live run.

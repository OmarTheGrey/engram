---
date: 2026-11-28
author: claude-agent
type: change
card: L9
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/configs/l9-grounding-fixture.json
  - fixtures/lint/l9-script.json
  - fixtures/cassettes/l9-grounding-fixture
  - packages/runner/test/lint-faults.test.ts
  - "make run CONFIG=research/configs/l9-grounding-fixture.json"
supersedes: none
---

**What.** The scripted fixture run with quote grounding on: config, script (card L3's verdicts, every reply in the grounded shape, four planted quotes) and 51 cassettes recorded from the script.

**Why.** The card's step 3, scripted-model fixtures and cassettes for both outcomes.

**Result.** The replay makes zero new calls and equals a fresh recording; its verdicts equal card L3's unit for unit, three flags are ungrounded (an invented word, a paraphrase, a 7-character quote) and a quote with doubled whitespace and a line break is found after folding. `lint-faults.test.ts`, `lint-nli.test.ts`, `lint-fault-set.test.ts`: 36 passed.

**Consequence.** The proof-of-concept result reads this run beside card L3's.

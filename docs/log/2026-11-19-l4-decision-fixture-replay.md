---
date: 2026-11-19
author: claude-agent
type: decision
card: L4
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/runner/scripts/fault-set-script.ts
  - research/configs/h3-lint-model-fixture.json
supersedes: none
---

**What.** The fixture replay lints two of the fixture set's 20 states at seeds 1 and 2, with a scripted model whose script `make fixtures` writes from the labels: a correct verdict on every unit but for listed planted answers.

**Why.** All 20 states send 1,265 units per seed, about 1.9 KB of cassette each, so 4.8 MB at two seeds; two states at two seeds is 250 cassettes, 472 KB. Planted answers make every scoring path checkable by hand; the labels reach the script file only, never a prompt or the plane, as a hand-written script's would.

**Result.** Every outcome kind appears: flag, pass, malformed, refused.

**Consequence.** A regenerated fixture set needs the script and cassettes rewritten; `make fixtures` does both.

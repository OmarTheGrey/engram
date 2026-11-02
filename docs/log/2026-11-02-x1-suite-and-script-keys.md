---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/configs/x1-h1-probe.json
  - fixtures/bench/gatemem/x1-probe-script.json
  - packages/runner/src/answers.ts
supersedes: none
---

**What.** `x1-h1-probe.json` is a suite: a config naming the two arm configs (`x1-h1-gatemem.json`, `x1-h1-mem-inv.json`), run into one output folder each with a total line. A scripted model's steps may be keyed `<item>@<condition>`, which C1 uses.

**Why.** The plan names one config covering both arms, but each arm is a different benchmark with its own schema and cassettes; a suite keeps each arm an ordinary config that `make fixtures` records. C1 has no memory tool, so its scripted session answers without the read the others make.

**Result.** `make fixtures` records the two arms; the suite replays both.

**Consequence.** A later hypothesis with several arms can reuse the suite form.

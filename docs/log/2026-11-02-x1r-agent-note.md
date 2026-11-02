---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/mem-inv-probe.ts
  - packages/bench/scripts/vendor-mem-inv-bench.py
  - packages/runner/test/x1-mem-inv.test.ts
supersedes: docs/log/2026-11-02-x1-mem-inv-full-case-set.md
---

**What.** MEM-INV-Bench's agent note is written by the model under test before the sessions, with upstream's prompt, temperature 0.3 and 300 tokens, and the raw input when the reply is empty or cut off; once per case and model, seeded with the config's first seed, cached under condition `note`.

**Why.** Upstream writes the note with the model under test (`build_memory`, `driver.gen`, one per scenario and model for every trial); eight cases carried another model's note (finding P3-4).

**Result.** pi-ai honours the temperature and token limit; the seed goes in `samplingParams` as for every answer. Scripted runs write the recorded note, so their memory is unchanged; the fallback test fails when truncation is ignored.

**Consequence.** H1's MEM-INV-Bench arm makes 8 note calls per model.

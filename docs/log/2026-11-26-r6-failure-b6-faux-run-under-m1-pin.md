---
date: 2026-11-26
author: claude-agent
type: failure
card: R6
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/test/b6.test.ts
  - "make test-one T=packages/runner/test/b6.test.ts"
supersedes: none
---

**What.** B6's live test failed once the H2 configs were pinned: it reads `h2-longmemeval-c5-medium.json` and runs it live on a faux model, which `answer_model` now refuses.

**Why.** The test builds its config from the registered one, so it inherited M1's pin, chosen for `openrouter/deepseek/deepseek-v4-pro-0813`, while it runs `faux-live/model-1`. The refusal is the intended behaviour.

**Result.** The test sets `openrouter_provider: undefined` on its faux config, as it already replaces the judge with a faux one; 12 of 12 pass. The other runner tests that build live configs (live, rv1, rv1-review, rv6, rv6-checks, rv6-upstream, x1-mem-inv, count, lint-faults, lint-fault-set) pass unchanged.

**Consequence.** A test that runs a registered config live on a faux model drops its pin.

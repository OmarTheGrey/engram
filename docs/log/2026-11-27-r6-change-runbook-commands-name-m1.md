---
date: 2026-11-27
author: claude-agent
type: change
card: R6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - docs/tasks/prereg-v1-plan.md
  - research/configs/openrouter-endpoints.json
  - "make test-one T=packages/runner/test/rv6-endpoints.test.ts"
supersedes: none
---

# R6: the runbook's live commands name M1, which the pinned configs require

**What.** Sections 7 and 8 of the runbook ran the smoke run and both H1 arms with `MODEL=openrouter/openai/gpt-5.6-terra`. Since R6 the runner refuses any model but a pinned config's `answer_model`, so each would be refused. They now name M1, `openrouter/deepseek/deepseek-v4-pro-0813` (lead-decisions item 1), and the cassette folder reads `cassettes-upstream-<hash>`. The answer turn's sent parameters list `max_tokens`, which pi-ai always sends; both pinned endpoints support it (23 of 23 pass).

**Why.** The verification of the fix pass found the smoke command refused; the H1 commands had the same fault.

**Result.** No `MODEL=` in the runbook names `gpt-5.6-terra`. The cost configs still price that model; the backlog row on the smoke run's price keeps that open.

**Consequence.** The commands run as written.

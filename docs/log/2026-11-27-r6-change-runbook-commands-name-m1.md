---
date: 2026-11-27
type: change
card: R6
status: done
---

# R6: the runbook's live commands name M1, which the pinned configs require

**What.** Sections 7 and 8 of `docs/tasks/prereg-v1-plan.md` ran the smoke run and both H1 arms with `MODEL=openrouter/openai/gpt-5.6-terra`. Since R6 the runner refuses a model other than a pinned config's `answer_model`, so every one of those commands would have been refused. They now name M1, `openrouter/deepseek/deepseek-v4-pro-0813` (the lead's answer of 2026-11-20, lead-decisions item 1), and the cassette folder reads `cassettes-upstream-<hash>`, the name a pinned config records under. `research/configs/openrouter-endpoints.json` also lists `max_tokens` among the answer turn's sent parameters, which pi-ai always sends; both pinned endpoints support it, and `rv6-endpoints.test.ts` passes 23 of 23.

**Why.** The verification of R6's fix pass found the smoke command refused (`scratchpad/verify-r6.md`, minor 1). The orchestrator found the H1 commands had the same fault.

**Result.** No `MODEL=` in the runbook names `gpt-5.6-terra`. The cost configs still price that model as data; the backlog row "The smoke run's price and commands" keeps that half open.

**Consequence.** The commands run as written at the smoke run and at H1.

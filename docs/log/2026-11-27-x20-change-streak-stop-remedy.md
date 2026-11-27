---
date: 2026-11-27
author: claude-agent
type: change
card: X20
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/model/cassette.ts
  - packages/runner/test/answer-refusal.test.ts
  - packages/runner/README.md
  - docs/tasks/prereg-v1-plan.md
supersedes: none
---

**What.** The backstop's stop message now says that the five items' refusals are recorded in the cassettes, so RESUME=1 replays them as refused, and names the manual remedy: delete those items' cassette entries that begin with the refused-answer mark, cut their rows from the end of results.jsonl (and events.jsonl for GateMem), then resume.

**Why.** The final review's finding 4: the old message said "check the provider, then rerun with RESUME=1", which brings none of the five back if the cause was a misread provider failure.

**Result.** A new test follows the remedy and the resume asks all six items again (12 calls, none refused). The runner README and the H1 runbook (`prereg-v1-plan.md`, section 7) say the same. answer-refusal.test.ts: 27 of 27.

**Consequence.** The operator has a documented way back after a misread.

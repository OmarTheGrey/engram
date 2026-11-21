---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/preregistration.md
  - packages/model/src/cached.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** GateMem's judge stays `openrouter/openai/gpt-4o`, the undated alias, as registered; the new requirement to pin it to a dated id is dropped (the coordinator's decision under the delegation, verification finding V-3).

**Why.** Item 1 says the judges stay as registered, and v1 calls `openai/gpt-4o` GateMem's pinned judge model.

**Result.** v1 states the alias as a limitation: its snapshot can change during a run. The ledger records each call's `upstream`, which the report gives, but not the model version OpenRouter resolved the alias to (`UsageRecord`, `packages/model/src/cached.ts`), so a backlog row adds it. Pre-tag condition 5 names the endpoints only; the judge-id backlog row is closed.

**Consequence.** The resolved model is recorded before the judge's version can be stated per call.

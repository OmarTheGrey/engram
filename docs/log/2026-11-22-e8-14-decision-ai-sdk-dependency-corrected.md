---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.14
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/deps.md
  - packages/ai-sdk/package.json
  - packages/ai-sdk/test/ai-package.test.ts
supersedes: docs/log/2026-11-21-e8-14-decision-ai-sdk-dependency.md
---

**What.** `@ai-sdk/provider` stays pinned at 4.0.36 with the peer range `>=4.0.36 <5`, and `ai` 7.0.163 is now a development dependency.

**Why.** Review finding E8.14-12 asked for a test against the real `ai` package; the earlier entry said `ai` was not a dependency.

**Result.** `ai` 7.0.163 (published 2026-11-05, Apache-2.0, read in its LICENSE) is the newest release at least two weeks old whose `@ai-sdk/provider` is 4.0.36. Its test runs `wrapLanguageModel` and `generateText`'s tool loop on the scripted model: the recall reaches the model, `remember` writes as model, a recall result is kept, a denial reaches the model as an `error-text` tool result.

**Consequence.** A change to `ai`'s tool shape now fails a test.

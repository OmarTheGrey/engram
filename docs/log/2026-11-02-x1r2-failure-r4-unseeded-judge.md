---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/judge.test.ts
supersedes: none
---

**What.** The first fix pass's live judge sent unseeded calls on the Responses API, contrary to ADR 0017 (finding R7-7).

**Why.** Upstream's payload was matched before the repository's own rule was checked.

**Result.** The judge runs on OpenRouter's seeded chat completions; a test pins the seed and the refusal.

**Consequence.** Found by the second review of PR #25 and fixed in its round-2 fix pass.

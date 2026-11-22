---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.9
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/policy/secrets-upstream.test.ts
supersedes: docs/log/2026-11-21-e2-9-finding-upstream-divergences.md
---

**What.** Ten vectors of the three sources come out otherwise here, on purpose, each pinned in `DIVERGENT` with its reason.

**Why.** The superseded finding counted six where the file held seven, and falsely said the walrus bearer value and the AWS example secret had been changed; the port now uses every source's own text, and three missing divergences are pinned (V-4).

**Result.** Not found: a Slack webhook with a 16-character path, `POSTGRES_PASSWORD=hunter2`, graphCTX's and walrus' cookie headers, `password=hunter2`, AWS's example key id, twenty of one letter, a short fine-grained token, `token = "..."` mid-sentence. Held, which walrus leaves alone: a build id with single capitals.

**Consequence.** A cookie rule and a shorter password floor remain choices for X14.

---
date: 2026-11-02
author: claude-agent
type: finding
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/model/cassette.ts
  - packages/runner/test/conditions.test.ts
supersedes: none
---

**What.** The committed cassettes show C3's and C4's policy JSON with doubled braces, but the model receives single ones.

**Why.** The review asked whether the doubled braces reach the model (J2).

**Result.** The doubling is the cache key's record only: ADR 0017 (finding R7-6) doubles braces before writing the session's working directory as `{cwd}`, so a literal `{cwd}` can never read as it. A test on a scripted session checks that the system message the model receives holds the policy with single braces and no `{{`.

**Consequence.** Nothing to fix.

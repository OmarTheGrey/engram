---
date: 2026-11-21
author: claude-agent
type: change
card: D1
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/scrub.ts
  - packages/core/src/distill/episode.ts
  - packages/core/test/unit/plane/bypass-corpus.test.ts
  - packages/runner/test/session-shapes.test.ts
  - "make test-one T=packages/core/test/unit/plane/bypass-corpus.test.ts"
supersedes: docs/log/2026-11-21-d1-review-change-fix-pass.md
---

**What.** The verification pass of card D1 fixes findings V-1 to V-9. Quoted values are redacted whole. Each omitted retry is its own attempt. The time checks are tested. Argv, env-pair, passphrase, pw, cookie and `mysql -p` shapes are covered, and `auth` is narrowed so `Author:` is kept. The fixtures follow pi's recovery order. Replacements are checked against pi's projection. Long names are checked with underscores as boundaries. The bypass corpus is committed.

**Why.** The verifier reproduced each finding with a probe.

**Result.** Tests pass: episode 27, scrub 56, bypass 24, bypass corpus 35, recorder 7, fixtures 53, shapes 43. The verifier's leak probe passes on all 26 shapes; the parser now keeps only ISO 8601 times. Three mutations each fail their tests.

**Consequence.** Card D2 reads one `omitted` attempt per failed try.

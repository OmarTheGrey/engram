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
  - packages/core/test/unit/distill/scrub.test.ts
  - docs/tasks/backlog.md
supersedes: docs/log/2026-11-21-d1-verify-scrub.md
---

**What.** The scrub is a best-effort pre-filter. It runs the bypass table unchanged, then rules of its own: a one-line named value (by the name's words), the MySQL `-p` password, `curl -u` and PEM key bodies, and argument walks. Card E2.9's content guard is the covering control.

**Why.** The lead's scope for the last pass: fix regressions and clear leaks, state the rest.

**Result.** Stated as not covered in the scrub's header, the first three tested as kept:
- escaped JSON and escaped quotes inside a value;
- header-pair arrays and `ParameterKey` and `ParameterValue` pairs;
- `os.environ[...] =`, XML, `:=` and `=>`;
- next-line values, prose secrets, and values split across fields;
- two-key flags, and `-p` beside other tools.

Over-redaction is kept as is, including the table's SHA and UUID rule.

**Consequence.** A backlog row asks the recording policy to turn on `content_guards.secrets`.

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
  - packages/runner/test/session-fixtures.test.ts
  - "make test-one T=packages/core/test/unit/distill/scrub.test.ts"
supersedes: docs/log/2026-11-21-d1-verify-change-pass.md
---

**What.** The last fix pass of card D1 makes four changes:
- the name hold reads underscores as spaces only for the key-shaped rules (W-2);
- the command rules cut the text at newlines and `;&|` and scan each piece once (W-3);
- names are split into words, so the table's secret names lose their values in text (W-1);
- attached `-pvalue` and a flag followed by an object are redacted (W-4).

Code, literals, types and openings are kept, and no value crosses a newline (W-6). `curl -u` and PEM key bodies are redacted (W-5). Recovered fixtures are checked for pi's order (W-8).

**Why.** The second verification found two regressions from the previous pass and remaining leaks.

**Result.** Tests pass: scrub 99, fixtures 54, recorder 7, shapes 43. Reverting W-2 or W-3 fails 5 and 3 tests.

**Consequence.** The remaining shapes are stated limits, covered by E2.9's guard.

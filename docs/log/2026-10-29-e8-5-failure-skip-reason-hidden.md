---
date: 2026-10-29
author: claude-agent
type: failure
card: E8.5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - test/e2e/inspector.e2e.test.ts
  - "make test-e2e"
supersedes: none
---

**What.** The Playwright test's skip reason, written with `console.warn` at module level, never reached the terminal when Chromium was missing.

**Why.** The plan says a missing browser skips locally with the reason printed. Checked by pointing `PLAYWRIGHT_BROWSERS_PATH` at an empty folder: the file reported 7 skipped and no reason, since vitest drops the console output of a file whose tests all skip.

**Result.** The reason is written to stderr directly; the same check prints `[e2e] inspector skipped: Chromium is not available (...); run pnpm exec playwright install chromium`. With `CI=1` the file fails with that message instead.

**Consequence.** None beyond the test.

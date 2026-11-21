---
date: 2026-11-21
author: claude-agent
type: finding
card: E8.11
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - test/e2e/item-page.e2e.test.ts
  - make test-e2e
supersedes: docs/log/2026-11-21-e8-11-long-log-timings.md
---

**What.** The long log's timings, quoted from one run: `make test-e2e` after the review fix pass, on 18,335 events visible to dana.

**Why.** Review finding E8.11-4: the earlier entry and PR.md quoted different runs.

**Result.** From that run's stderr: first render 265 ms, sort by seq descending 59 ms, filter by actor 26 ms, in headless Chromium on this machine under shared load. These are a single run, not a distribution: earlier runs gave 234/28/22 and 217/43/21 ms, and the reviewer's 267/48/23 ms. The bound the test asserts is fewer than 200 rows in the page, and under 10 s for the sort. The plane's write cost on a long log stands as the earlier entry gives it.

**Consequence.** PR.md quotes this run.

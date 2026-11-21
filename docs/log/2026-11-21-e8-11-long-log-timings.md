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
supersedes: none
---

**What.** On the long log the event table rendered 18,335 visible events with fewer than 200 rows in the page.

**Why.** The card asks that the table stay fast at tens of thousands of events.

**Result.** From the e2e run's stderr: first render 234 ms, sort by seq descending 28 ms, filter by actor 22 ms, in Chromium headless on this machine under shared load. Building the log is slower: 2,000 allowed writes took 10.8 s, and 24,000 writes at one in a hundred allowed took 30 s against 3.9 s for 12,000, so Plane.write grows faster than linearly with the log.

**Consequence.** The plane's write cost on a long log may interest card X15's budget.

---
date: 2026-11-21
author: claude-agent
type: failure
card: E8.11
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - test/e2e/item-page.e2e.test.ts
supersedes: none
---

**What.** The first e2e run failed one test and could not open a page for the long-log suite.

**Why.** My expectation for sam's team item graph left out the checklist below it (descendants are shown, as the unit test says), and the first suite's afterAll closed the browser both suites share.

**Result.** The expectation now names both items and the one lineage edge; each suite closes its page and a file-level afterAll closes the browser. Then 13 of 13 passed. A later `make lint` refused DOM globals in the test (the root tsconfig has no DOM lib); the test now reads the hash from page.url() and fetches the entry bundle from Node.

**Consequence.** None.

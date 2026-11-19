---
date: 2026-11-20
author: claude-agent
type: failure
card: X4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/tests/test_h1_figure.py
  - "page.screenshot: Timeout 30000ms exceeded (playwright, Chromium, a file:// SVG)"
supersedes: none
---

**What.** Looking at the planted figure by screenshotting the SVG file in Chromium through playwright timed out after 30 seconds.

**Why.** To check the layout by eye, which the byte and structure tests cannot (label collisions, geometry). The page was the bare SVG opened as a `file://` URL with a full-page screenshot.

**Result.** Embedding the same SVG in an HTML page with `setContent` and a viewport screenshot worked; the planted figure showed no collision but a small overlap of C5's rate label with its whisker near zero. The throwaway script lived outside the repository's committed files and was deleted.

**Consequence.** Nothing in the repository changes; a reviewer who wants to look at the figure opens the SVG in a browser.

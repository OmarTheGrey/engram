---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15b
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/app.ts
  - packages/cli/test/tui/entry.test.ts
supersedes: none
---

**What.** The mouse stays captured by default, as the lead decided (docs/design/tui.md 14, item 5), now doing what it captures: the wheel moves lists, results, the first loop and overlays; a click selects a Home row and a double click opens it. Any other press is left to pi-tui's text selection.

**Why.** Review I8: the mouse was captured and did nothing. pi-tui 1.3.0 hands mouse events to layout nodes only, so the App reads the reports it takes from the terminal before pi-tui does.

**Result.** review.test.ts covers wheel and click; entry.test.ts holds the default on and `--no-mouse` off.

**Consequence.** Clicks on form fields and palette rows are left for a later part.

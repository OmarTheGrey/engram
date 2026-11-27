---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.15b
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/app.ts
supersedes: none
---

**What.** Two dead ends wiring the mouse: an App `handleMouse` was never called, and making the App the layout root or adding an input listener did not help.

**Why.** pi-tui 1.3.0 dispatches mouse events to layout nodes only, and its alternate screen reads mouse reports before any input listener.

**Result.** The App wraps the terminal's input and takes the SGR reports it handles before pi-tui sees them; the rest pass through.

**Consequence.** A pi-tui bump that changes input order is caught by review.test.ts's mouse test.

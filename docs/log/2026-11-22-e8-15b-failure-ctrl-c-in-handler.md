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

**What.** My fix for I1 quit on ctrl+c inside pi-tui's input handler; under ConPTY the TUI then exited 1 and printed no summary, while every headless test passed.

**Why.** pi-tui went on with the key after its terminal had stopped. The FakeTerminal does not reproduce that.

**Result.** The quit now runs on the next turn of the event loop (setImmediate); the reviewer's s8 exits 0 and prints the redacted summary.

**Consequence.** A change to quitting is checked under the pseudoconsole, not only headless.

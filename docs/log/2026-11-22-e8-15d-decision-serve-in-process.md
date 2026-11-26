---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15d
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/serve.ts
  - packages/cli/src/tui/app.ts
supersedes: none
---

**What.** Serve and MCP over HTTP run through the CLI's own `run` in the TUI's process with an `Io.stop` the screen holds; quitting stops them first, waiting up to ten seconds, and each is recorded once with its exit code, noted "stopped when the TUI quit" when quitting stopped it. The screen shows no live request count, and `o` copies the inspector's address instead of starting a browser.

**Why.** docs/design/tui.md 8.13. The served requests do not pass through `Io.transport`, so a count would need a change to `packages/server`, out of this card's files; starting a browser from tests and over SSH is a side effect the address link (OSC 8) and a copy avoid.

**Result.** flows-surfaces.test.ts starts, stops and quits a server on port 0.

**Consequence.** A request count can come with a server hook later.

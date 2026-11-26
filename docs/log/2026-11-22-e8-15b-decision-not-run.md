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
supersedes: none
---

**What.** The generated forms of serve, mcp and the hook build and copy their command but do not run it; the status line says their screens come with E8.15d.

**Why.** serve runs until stopped, mcp over stdio and the hook use the terminal's own stdin and stdout, and 8.13 to 8.15 design their screens (Try it, snippets) for E8.15d.

**Result.** keys.test.ts checks serve runs nothing.

**Consequence.** If wrong, a person runs serve from a shell for now.

---
date: 2026-11-28
author: claude-agent
type: change
card: E8.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/setup.ts
  - packages/cli/src/tui/snippets.ts
  - packages/cli/src/tui/line.ts
  - packages/cli/test/tui/frames-surfaces.test.ts
  - packages/cli/test/tui/flows-surfaces.test.ts
supersedes: none
---

**What.** The TUI's hook setup screen gains a Harness row (Claude Code or Codex), Codex's `.codex/hooks.json` snippet and Try it with Codex's Bash samples, and an Install button that runs `engram hook install` through the confirmation; line mode has `codex hook setup`.

**Why.** The lead wants every command reachable from the TUI, with the Codex setup beside Claude Code's.

**Result.** Frames at 80x24 and 120x40 in four modes for the Codex screen; the hook and palette frames were regenerated after reading their diffs (a new row and button; one more palette entry). `no-policy.test.ts` passes unchanged.

**Consequence.** The two new entries are not Home rows (decision entry home-rows).

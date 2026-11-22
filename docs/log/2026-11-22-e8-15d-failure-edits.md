---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/parity-surfaces.test.ts
  - fixtures/stores/claude-code-memory
supersedes: none
---

**What.** Three slips on the way: a shell heredoc collapsed `\\` to `\`, so Python wrote a backspace byte into a regular expression and raw control characters (ESC, ctrl+s) into two test files; Python in text mode wrote CRLF line endings into one test file; and a probe of the plain CLI wrote one memory file into `fixtures/stores/claude-code-memory`, used as a store root by mistake.

**Why.** Edits made by heredoc scripts on Windows, and a probe run with a fixture as `--root`.

**Result.** The control bytes were found by a scan and written as escapes, the endings normalised to LF, and the stray file removed (`git status fixtures/` clean). Later edits used script files.

**Consequence.** Probes take a copy of a fixture, never the fixture.

---
date: 2026-11-23
author: claude-agent
type: failure
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/parity-surfaces.test.ts
  - packages/cli/test/tui/frames-surfaces.test.ts
  - packages/cli/test/tui/snippets.test.ts
supersedes: none
---

**What.** After the merge 19 tests failed before the fits: the AST guard; 16 ASCII frames; the every-flag parity test; the Serve flow with a created key. Later the new quit-kill test failed on its first run.

**Why.** E8.15c's fold glyph in ASCII is `+`; its `syncWorkspace` puts the workspace's value back in every workspace field not touched, so a key file set by the Create a key callback, and the parity test's set values, were replaced. The quit-kill test read the frame through `settled()`, which waits for the key that waits on the child; and a Try it's second sample started after the quit had cleared its stops.

**Result.** Frames regenerated (the glyph only); a set key file is touched; the parity test touches what it sets; the test draws without settling; `onQuit` after the quit stops at once.

**Consequence.** Nothing further.

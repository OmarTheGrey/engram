---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.15b
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/keys.test.ts
  - packages/cli/test/tui/frames.test.ts
supersedes: none
---

**What.** Edits and tests that went wrong on the way: shell-quoted Python edits lost backticked words and turned escaped key codes into raw control bytes; four key-flow tests and the too-small checks assumed the wrong keys or text.

**Why.** Bash substitutes backticks inside double quotes, and an unquoted escape in a Python string becomes the byte; the tests assumed tab moves between log choices, that --keys sits outside the workspace fold, a first-run start on the log question, and an untrimmed terminal row.

**Result.** Edits moved to the Edit tool and script files; a scan finds no control byte or dash in the new files; the tests now follow the built behaviour, each checked against a frame.

**Consequence.** None in the code.

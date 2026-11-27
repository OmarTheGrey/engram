---
date: 2026-11-26
author: claude-agent
type: change
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - README.md
  - packages/cli/README.md
  - docs/design/screens/index.md
  - make engram ARGS="--help"
supersedes: none
---

**What.** Main, with the terminal interface (PR #114), is merged into `readme-tui`, and the review's HIGH-1 and MEDIUM-3 are fixed against it.

**Why.** The READMEs described the TUI as both merged and pending, and their captions had been read from a branch still changing.

**Result.** Both conflicted READMEs keep this branch's text, since main's copies equal the `cliupgrade` text it was built on. The root README says the TUI landed on 2026-11-26, and its CLI row lists all 23 commands `engram --help` prints. Of the screenshots, only `mcp` and `explain` changed; the captions match, and the MCP line names `agent:codex`. The CLI README takes main's tripwire guard and `--work` rule. All 236 relative links in the 15 changed READMEs resolve.

**Consequence.** None of the review's findings is open.

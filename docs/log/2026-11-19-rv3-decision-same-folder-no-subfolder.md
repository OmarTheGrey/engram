---
date: 2026-11-19
author: claude-agent
type: decision
card: RV3
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0013-adapter-contract-and-conformance.md
  - docs/dogfood.md
  - "https://code.claude.com/docs/en/memory.md (How it works, read 2026-11-19)"
supersedes: none
---

**What.** Engram's item files stay in the memory folder itself, not a subfolder, now that `MEMORY.md` no longer names them.

**Why.** The card asked for a subfolder only if the same folder still exposed the items. Claude Code's memory documentation says the first 200 lines or 25 KB of `MEMORY.md` load at the start of every conversation, and topic files are read on demand with Claude's file tools, which the no-bypass hook blocks inside the folder. A subfolder lies under the same root and the same tools, so it would hide nothing more while changing every key.

**Result.** No key changes. Cost if wrong: if a later Claude Code loads other files of the folder at startup, items would reach sessions unfiltered and a subfolder or another root would be needed; without the hook, Claude Code can read an item file like any file.

**Consequence.** ADR 0013's amendment records it.

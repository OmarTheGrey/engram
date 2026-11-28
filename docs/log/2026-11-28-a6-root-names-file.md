---
date: 2026-11-28
author: claude-agent
type: decision
card: A6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/workspace.ts
  - packages/cli/src/registry.ts
supersedes: none
---

**What.** For `--store mcp-memory`, `--root` names the memory file itself, as the server's MEMORY_FILE_PATH does, not a folder holding `memory.jsonl`; a missing file is an empty graph that the first write creates, and `--import-valid-from` applies as for the files store.

**Why.** A user configures the server with a file path; asking for its folder would guess the file name. The lock and temporary files live beside it, as the server's do.

**Result.** The usage error says `the mcp-memory store needs --root <memory.jsonl>`.

**Consequence.** `engram doctor --root` still checks a folder for the files adapter; the mcp-memory check runs on its own temporary file.

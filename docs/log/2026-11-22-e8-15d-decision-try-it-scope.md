---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15d
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/snippets.ts
  - packages/cli/src/tui/screens/setup.ts
supersedes: none
---

**What.** Try it also drops `--otlp` and `--export-jsonl` and removes `ENGRAM_TOKEN`, `ENGRAM_OTLP_URL` and `ENGRAM_EXPORT_JSONL`, each listed with the other replacements; MCP's Try it speaks stdio only, and over HTTP the screen runs `engram mcp --http` in the TUI's process with Start and Stop, as Serve does.

**Why.** Replacing `--server` by `--db :memory:` would let a decision export reach its collector, which a scratch run must not; and an HTTP server is started, not handshaken by a child.

**Result.** snippets.test.ts lists every replacement and counts zero requests to a fake server named by `--server` and `ENGRAM_SERVER_URL`.

**Consequence.** If wrong, a person checks export by a real run.

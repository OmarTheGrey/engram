---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15a
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/registry.ts
  - packages/cli/test/registry.test.ts
supersedes: none
---

**What.** Each CommandSpec names the environment variables it reads in `env`, and doctor names the file its provider key names come from in `envFrom`.

**Why.** The lead's decision in the E8.15a review: the TUI's workspace screen shows each variable with its source.

**Result.** Plane commands read ENGRAM_DB_URL, ENGRAM_SERVER_URL, ENGRAM_TOKEN, ENGRAM_OTLP_URL and ENGRAM_EXPORT_JSONL through connect; serve the first, fourth and fifth; hook adds CLAUDE_PROJECT_DIR; log and doctor ENGRAM_DB_URL; key none. A test scans packages/cli/src and packages/server/src for every variable read and finds each in some entry. ENGRAM_TUI_LINE belongs to the `tui` entry, which E8.15b adds; no file here reads it.

**Consequence.** E8.15b's `tui` entry lists ENGRAM_TUI_LINE and its other variables.

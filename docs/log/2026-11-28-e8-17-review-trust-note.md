---
date: 2026-11-28
author: claude-agent
type: failure
card: E8.17
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0022-other-harnesses-through-mcp.md
  - packages/cli/src/hook-install.ts
supersedes: none
---

**What.** The ADR amendment said a user-level Codex hook needs no trust, and the installer printed its trust note for project installs only; both were wrong at the pin.

**Why.** Codex's discovery treats the user layer as unmanaged, and an unmanaged hook runs only when trusted (`codex-rs/hooks/src/engine/discovery.rs`), again after any change to its hash.

**Result.** The amendment, README, the installer's note and the TUI's text now say a hook needs trusting at either level and again after each change; the installer test checks the note on `--user`.

**Consequence.** Every re-install that changes the entry asks the member to trust it again.

---
date: 2026-11-28
author: claude-agent
type: decision
card: E8.17
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/hook-install.ts
supersedes: none
---

**What.** The installer writes Codex's `hooks.json`, never a `[hooks]` table in `config.toml`.

**Why.** Codex reads both (`codex-rs/hooks/src/engine/discovery.rs`); merging JSON needs no TOML library and keeps the user's TOML byte for byte.

**Result.** One file per harness and scope, JSON only; Codex warns when both representations hold hooks.

**Consequence.** A user whose hooks live in config.toml gets a second representation and Codex's warning; nothing is lost.

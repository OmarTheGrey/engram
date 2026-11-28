---
date: 2026-11-28
author: claude-agent
type: finding
card: E8.17
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0022-other-harnesses-through-mcp.md
  - packages/cli/src/hook-install.ts
supersedes: none
---

**What.** A project's Codex hook runs only once the user trusts it in `/hooks`; until then the project entry blocks nothing.

**Why.** Codex's discovery marks unmanaged hooks untrusted until their hash is recorded (`codex-rs/hooks/src/engine/discovery.rs`, `hook_trust_status`).

**Result.** The installer says so after a project install; a `--user` install has the same trust step for a changed hash. Not tested against a real Codex (no Codex on this machine).

**Consequence.** docs/dogfood.md should tell members to trust the hook after installing; left to the dogfood card.

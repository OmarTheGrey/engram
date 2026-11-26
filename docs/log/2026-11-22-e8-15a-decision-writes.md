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
supersedes: none
---

**What.** `writes` follows 9.5, settling the cases it leaves open: read, `read --item` and `scopes` are state with a store folder or a server named, else audit; supersede is state only with `--accept`; export is file only with `--out`; hook is audit; mcp is process over stdio too.

**Why.** A server may hold a store, so a read through it may sweep; scopes runs the same sweep and adoption since E8.14 (review finding E8.14-11).

**Result.** The registry test pins each of these answers.

**Consequence.** Asking once too often for a server read is the cost if wrong; never asking too rarely.

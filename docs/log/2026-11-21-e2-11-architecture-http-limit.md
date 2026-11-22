---
date: 2026-11-21
author: claude-agent
type: change
card: E2.11
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/architecture.md
supersedes: none
---

**What.** The architecture states the trust floors on the write path and the HTTP limit beside the existing authentication limit.

**Why.** ADR 0040, decision 2 and card E2.11 step 3: the floor does not close a self-asserted `source: user` over HTTP.

**Result.** The write path gains a paragraph on both options; the open items gain the limit: on the HTTP API the source comes from the request body, so a client sending `source: user` is believed, until verified actors (card E8.12). The surfaces were checked: the CLI, MCP server, hook, pi extension and adoption already set a source (`docs/log/2026-11-21-e2-7-finding-gh-39-surfaces.md`), so no surface code changed.

**Consequence.** Card E8.12 removes the limit.

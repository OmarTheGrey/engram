---
date: 2026-11-21
author: claude-agent
type: change
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/log.ts
  - packages/cli/src/run.ts
  - packages/cli/test/log.test.ts
supersedes: docs/log/2026-11-21-e1-6-change-cli-log.md
---

**What.** engram log verify and engram log checkpoint after the fix pass: the chain is kept by the shared opener, log checkpoint takes --checkpoint and pins its own key, and the help states the verdict rule and what cannot be detected.

**Why.** Review findings E1.6-1, E1.6-2, E1.6-7 and E1.6-11.

**Result.** The CLI test: no key pinned gives UNSIGNED, exit 3; signing over a rebuilt log that a held checkpoint contradicts is refused, exit 1; the fixture log still verifies OK under a pinned signed checkpoint.

**Consequence.** AGENTS.md and CLAUDE.md carry the same rule.

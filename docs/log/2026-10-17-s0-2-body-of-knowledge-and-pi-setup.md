---
date: 2026-10-17
author: omar
type: milestone
card: S0.2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - "make lint-docs"
  - scripts/check-prose.ts
  - scripts/check-log.ts
  - .pi/APPEND_SYSTEM.md
  - .claude/commands/card.md
supersedes: none
---

**What.** Step-0 task S0.2 completed the body of knowledge and the harness setup: `make lint-docs` (em dashes in prose, CLAUDE.md equals AGENTS.md, log entry field set), a log template at `docs/log/_template.md`, the card prompt pattern and session rules in `.pi/APPEND_SYSTEM.md`, and `.claude/` settings and commands mirroring the three pi prompts.

**Why.** CLAUDE.md was described as a symlink, which is unreliable on Windows, so it is now a copy that CI compares byte for byte.

**Result.** pi 1.3.0 in RPC mode (`get_commands`, run with `-a`) lists `adr`, `card` and `log-entry` as project prompts; its resource loader finds one context file, AGENTS.md, so the copy is not loaded twice. `make lint-docs` passes, and fails on a seeded em dash, a drifted CLAUDE.md and an entry missing fields.

**Consequence.** S0.3 hardens the log validator and adds the PR checks.

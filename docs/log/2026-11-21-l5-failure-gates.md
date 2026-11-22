---
date: 2026-11-21
author: claude-agent
type: failure
card: L5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/near_duplicate.py
  - packages/core/test/unit/lint/near-duplicate-presets.test.ts
supersedes: none
---

**What.** First gate runs failed: tsc on an `Actor` imported from schema.ts (it lives in actor.ts), ruff on a lambda bound to a loop variable and long lines, mypy on datasketch's missing stubs.

**Why.** Each was an error of the new code.

**Result.** Fixed in place; then ruff, mypy (75 files) and tsc pass. Two API timeouts also interrupted the card; work resumed from git.

**Consequence.** Nothing.

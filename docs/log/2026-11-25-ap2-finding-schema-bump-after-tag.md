---
date: 2026-11-25
author: claude-agent
type: finding
card: none
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - docs/log/2026-11-21-e2-8-version-bump-moves-cassette-keys.md
  - packages/runner/src/conditions.ts
  - docs/research/absorb/00-master-plan.md
supersedes: none
---

**What.** The research's plans assume schema changes with a `schema_version` bump, and after the tag any bump moves registered bytes.

**Why.** The master plan lists eight schema pull requests with bumps; card E2.8 found that C3 and C4 embed the parsed policy, its version included, in their prompts.

**Result.** Since the policy shares `SCHEMA_VERSION` with items and events, a bump after 1 December makes H1's live cassettes miss on main and moves the fault-set hashes `research/configs/h3-lint-model.json` pins.

**Consequence.** The second plan bumps nothing. A backlog row asks for an ADR separating the versions before any schema plan returns.

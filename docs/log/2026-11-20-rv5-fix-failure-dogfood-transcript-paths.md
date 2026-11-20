---
date: 2026-11-20
author: claude-agent
type: failure
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/dogfood.md
supersedes: none
---

**What.** Review of PR #59, RV5-6: `docs/dogfood.md`'s transcript limit named only `projects/<project>/<session>.jsonl`, not `<session>/tool-results/` or `<session>/subagents/`, where MCP results also land, and said nothing of `history.jsonl`.

**Why.** The limit was written from the transcript row of Claude Code's docs only.

**Result.** Limit 7 now names both folders, and says that `history.jsonl` keeps typed prompts until deleted, that `cleanupPeriodDays` does not prune it (only the HIPAA configuration does), and that `claude purge <project>` removes a project's lines (checked against https://code.claude.com/docs/en/claude-directory, "Application data").

**Consequence.** Members know every place a memory read can persist outside the plane.

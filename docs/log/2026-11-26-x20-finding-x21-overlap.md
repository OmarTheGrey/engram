---
date: 2026-11-26
author: claude-agent
type: finding
card: X20
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - research/analysis/h1.py
supersedes: none
---

**What.** X20 and X21 both edit `h1-sessions.ts` and `h1.py`; X20's hunks are kept apart from X21's.

**Why.** X21 adds `capped` to H1Session (its lines 83 to 84), `cappedOf` to ConvertHooks (260 to 261), one line in convert's utility branch after `action_ok` (304), and one in gatememSessions (337); in h1.py it adds `capped` parsing and `capped_utility`.

**Result.** X20 adds `exclusion` to UtilityVerdicts, a reason in gatememUtility, and one line after `violation: null` in the utility branch, three unchanged lines above X21's; in h1.py it edits the utility-exclusion check in parse_session and adds `utility_exclusions` in `_mgs`. `cappedOf` compares only to "turn limit", so the widened type holds.

**Consequence.** The merge after X21 should be clean or a two-line conflict in the utility branch; keep both.

---
date: 2026-11-21
author: claude-agent
type: failure
card: D2
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/scripts/skill-spec-golden.py
supersedes: none
---

**What.** The first validator run reported `café` as `cafÃ©`, with three false errors.

**Why.** skills-ref reads SKILL.md in the platform encoding, and `python -I` ignores `PYTHONUTF8`.

**Result.** The command is now `python -I -X utf8`. The rerun gives no error for the case.

**Consequence.** The script's header records the flag.

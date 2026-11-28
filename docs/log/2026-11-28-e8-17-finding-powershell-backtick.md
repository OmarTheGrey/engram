---
date: 2026-11-28
author: claude-agent
type: finding
card: E8.17
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
supersedes: none
---

**What.** Core's shell check misses a PowerShell backtick escape inside a path word: ``Get-Content mem`ory\a.md`` reads `memory\a.md` in PowerShell but passes both of core's readings.

**Why.** Found while looking for a spelling where the POSIX and PowerShell readings differ (decision both-shell-readings).

**Result.** Probed with `shellBypass` on a root `memory`: false under posix and powershell. Not fixed: core is outside this card's files.

**Consequence.** A card on core's no-bypass checks should strip PowerShell's backtick escapes before the path check.

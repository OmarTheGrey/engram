---
date: 2026-11-29
author: claude-orchestrator
type: failure
card: E9.11
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - docs/log/2026-11-29-orch-decision-accept-adr-0051.md
supersedes: none
---

**What.** The orchestrator's ADR numbering commit on card E9.11 staged `PR.md`, the PR description that stays out of git, and it reached main in #167. It is removed.

**Why.** A `git add` named `PR.md` beside `docs`.

**Result.** Main holds no `PR.md`.

**Consequence.** The orchestrator stages only named paths under docs, packages and research.

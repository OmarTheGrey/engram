---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/research/preregistration.md
  - docs/tasks/prereg-v1-plan.md
supersedes: none
---

**What.** V-2: v1 promised MEM-INV-Bench's count of sessions that read memory before acting (ADR 0029), but the table did not report it.

**Why.** The ADR's requirement was copied into the analysis line without a source in the table.

**Result.** Found by the final verification of PR #27.

**Consequence.** D3: the table reports `read_before_action` per condition; v1 and section 7 name it.

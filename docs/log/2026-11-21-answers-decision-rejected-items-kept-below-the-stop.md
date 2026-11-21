---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/preregistration.md
  - docs/research/label-audit.md
  - research/scripts/label_audit_agreement.py
  - docs/decisions/0015-evaluation-protocol.md
supersedes: docs/log/2026-11-21-answers-decision-rejected-items-excluded.md
---

**What.** Below the audit's 10 percent threshold, rejected items are kept and listed in v1; when the stop trips they are dropped and the run proceeds (item 6(a)). The coordinator reversed his earlier decision to exclude them either way (verification finding V-4).

**Why.** Excluding them either way left the stop rule stopping nothing; the procedure on main said "do not silently drop it", and ADR 0015's amendment and `label_audit_agreement.py`'s `drop` response tie dropping to a tripped stop.

**Result.** v1's Benchmarks paragraph, `docs/research/label-audit.md` steps 4 and 5, pre-tag condition 1 and the backlog row say so.

**Consequence.** The H1 table needs an input for dropped items only if a stop trips.

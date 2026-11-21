---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.10
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - fixtures/injection-screen/corpus.json
  - research/configs/injection-screen.json
supersedes: none
---

**What.** The corpus takes AMSB's twelve attacks outside sensitive_data, written as kind tool (AMSB's external_tool), and its six benign scenarios, written by a user and again by a tool; the card's standing preferences are written by a user (benign) and by a tool, a by-design group reported apart from both rates.

**Why.** Secrets are card E2.9's guard. A tool writing "always answer in French" is exactly what ADR 0039 item 5 holds on purpose, so counting it as a false hold or as an attack would each misstate the screen.

**Result.** Escape over 12 attacks, false hold over 47 controls, by-design over 15.

**Consequence.** Card X14's suite should replace these attacks with ones not drawn from the detectors' own project.

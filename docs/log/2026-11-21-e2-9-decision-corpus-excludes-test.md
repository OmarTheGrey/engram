---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/configs/secret-guard.json
supersedes: none
---

**What.** The benign corpus leaves out every path containing `/test/`, vendored files and the generated UI client.

**Why.** Test folders hold fake secrets on purpose (the bypass tests, this card's), which are not benign text; vendored and generated files are not the repository's own prose or code.

**Result.** 14,587 paragraphs of 2,153 files at commit e4ea83e.

**Consequence.** The corpus is mostly prose and source; logs, configs and shell transcripts are under-represented, which card X14's corpus should cover.

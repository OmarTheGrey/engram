---
date: 2026-11-21
author: claude-agent
type: decision
card: X14
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/configs/redteam.json
  - docs/research/absorb/19-github-scout.md
supersedes: none
---

**What.** The guard settings set `max_content_bytes` to 65,536.

**Why.** ADR 0039 names the option and no value; 64 KiB is the threshold of OWASP Agent Memory Guard's own size detector, which AMSB's size_anomaly scenario was written against.

**Result.** AMSB's 150,000-character payload is denied, and so is the 135,000-character build log of the controls' size twin.

**Consequence.** Another limit moves those two rows only. Cost if wrong: two rows.

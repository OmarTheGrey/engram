---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - specs/commit.qnt
supersedes: none
---

**What.** The first simulation of the good model reported a violation of noStaleAppend at seed 1 (2,000 traces of 40 steps).

**Why.** A writer's own bytes had been adopted before it committed, which the code's check ignores by content (commit.ts ownBytes). The later erasure redacted the content of both events, so the property, reading the log afterwards, could no longer match them. The protocol was right and the property was wrong.

**Result.** Each event now carries a ghost field `orig`, its content as appended, which no step reads and only the properties do. The same seed then passed, and 5,000 traces at each of three seeds passed.

**Consequence.** A property that reads past events has to read them as they were appended, not as redaction left them.

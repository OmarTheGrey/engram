---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.10
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/injection-screen.ts
supersedes: none
---

**What.** exfil-sink reads only the kinds a person did not type, as standing-directive and memory-persistence do; the other five rules read every kind.

**Why.** ADR 0039 item 5 names only the two OWASP rules; Mnemowall conditions its sink signals on the source too (a sink is new relative to trusted turns), and a person storing their own install command is not an attack.

**Result.** Tested both ways for each sink signal.

**Consequence.** A user-typed image beacon or credential path is not screened; costs nothing for the poisoning arm, whose attacks come from tools.

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
  - research/results/h1-injection-screen.json
supersedes: none
---

**What.** Each signal of standing-directive, exfil-sink and four of obfuscation's five weighs 2 under default and 4 under hardened; the other rules' signals weigh 4 (encoded-blob 5, tag characters 4) under both.

**Why.** OWASP's standing-directive phrases and Mnemowall's sink signals each occur in ordinary documents ("Always back up the database", a `curl | sh` install line, a README badge). Default holds them only when two signals or another rule agree; hardened, the opt-in profile, holds any one.

**Result.** Default holds 0 of 15 tool-written one-signal preferences and hardened 11 of 15 (the corpus result).

**Consequence.** Under default a single quiet directive from a tool passes; a policy that wants it held chooses hardened.

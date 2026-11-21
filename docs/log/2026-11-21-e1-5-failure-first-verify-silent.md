---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - npx --yes @informalsystems/quint@0.33.1 verify --invariant=bounded --max-steps=5 toy.qnt
supersedes: none
---

**What.** The first `quint verify` on the toy printed nothing for more than six minutes and started no JVM; it was stopped.

**Why.** It was downloading Apalache's 197 MB jar into ~/.quint with no progress output, which looks the same as a hang.

**Result.** With the jar in place, the same command finished in 8 s (`[ok] No violation found`). `java -jar apalache.jar version` printed 0.62.4.

**Consequence.** specs/README.md says the first run fetches Apalache once, so a silent first `make verify-spec` is not mistaken for a hang.

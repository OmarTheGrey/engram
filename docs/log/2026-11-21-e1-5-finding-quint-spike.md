---
date: 2026-11-21
author: claude-agent
type: finding
card: E1.5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - npx --yes @informalsystems/quint@0.33.1 --version
  - java -version
  - docs/deps.md
supersedes: none
---

**What.** The spike: Quint 0.33.1 through npx, its simulator, and Apalache 0.62.4, on this Windows 11 machine, on a three-line toy spec.

**Why.** Card E1.5 starts with a spike, since Apalache needs a JVM and nothing in the repository had run one.

**Result.** `quint typecheck`, `quint test` and `quint run` passed the toy and refuted a false invariant (`[violation] Found an issue`). The first run fetched the Rust evaluator v0.7.1 into ~/.quint. A JVM is present (Temurin 21.0.11). `quint verify` fetched Apalache 0.62.4 (a 197 MB jar) and then checked the toy to 5 steps in 8 s and found the toy's counterexample in 8.5 s.

**Consequence.** Apalache runs here, so `make verify-spec` uses both the simulator and bounded model checking; it skips Apalache with a message where no JVM is on the path.

---
date: 2026-11-28
author: claude-agent
type: finding
card: E2.18
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - tools/symcc/Cargo.toml
  - tools/symcc/Cargo.lock
  - "make verify-policy"
supersedes: none
---

**What.** The card's first step, a spike: Cedar's symbolic compiler built and run on this Windows machine, offline once fetched.

**Why.** The card asked whether cedar-policy-symcc and cvc5 run here before anything is built on them, and to log the answer either way.

**Result.** Yes. cedar-policy-symcc 0.8.1 builds with cargo 1.93.1 on the MSVC toolchain in about a minute (`cargo build --release` in tools/symcc), and cvc5 1.4.2's Win64 static release (sha256 `9055de9b...`) runs without installation. The 13 checks of the first config are answered in about 0.7 s; the whole script, node steps included, in about 2.6 s. After the crates and cvc5 are fetched, nothing reaches the network.

**Consequence.** The card goes ahead as written; no fallback such as a hand-written SMT encoding is needed.

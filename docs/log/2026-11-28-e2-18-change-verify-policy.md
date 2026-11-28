---
date: 2026-11-28
author: claude-agent
type: change
card: E2.18
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - Makefile
  - AGENTS.md
  - "make verify-policy"
supersedes: none
---

**What.** make verify-policy: the result script into .engram/verify-policy, compared byte for byte with the committed research/results/h2-cedar-properties.json, outside make test.

**Why.** The card's acceptance; the card asked that it skip with a message when cargo or cvc5 is missing.

**Result.** On this machine: `verify-policy: every property as expected, and the result is the committed one`. With cargo off the PATH it prints `verify-policy: skipped: cargo is missing (install Rust with rustup)` and exits 0; with CVC5 naming a missing file, `verify-policy: skipped: cvc5 1.4.2 is missing ...` and exits 0. A property not as the config expects exits 1 after printing its counterexample.

**Consequence.** AGENTS.md and CLAUDE.md list the command.

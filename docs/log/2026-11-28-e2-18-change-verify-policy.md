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
  - research/scripts/h2_cedar_properties.py
  - "make verify-policy"
supersedes: none
---

**What.** make verify-policy: the result script into .engram/verify-policy, compared byte for byte with the committed research/results/h2-cedar-properties.json, outside make test.

**Why.** The card's acceptance; the card asked that it skip with a message when cargo or cvc5 is missing, and the review asked that a tool's failure not read as a property's.

**Result.** On this machine: `verify-policy: every property as expected, and the result is the committed one`. Without cargo it prints `verify-policy: skipped: cargo is missing ...` and exits 0; without cvc5 the script exits 3 and make prints the skip. A failing tool (cargo, a cvc5 at another version, tools/symcc, node) makes the script exit 4 and make say `a tool failed ...; no property was decided`. A property not as expected exits 1 after printing its counterexample.

**Consequence.** AGENTS.md and CLAUDE.md list the command.

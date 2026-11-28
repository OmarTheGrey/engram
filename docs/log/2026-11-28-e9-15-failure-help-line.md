---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.15
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - make test-one T=packages/cli/test/registry.test.ts
supersedes: none
---

**What.** Adding `audit` to HELP's shared line of commands that make no client call failed the registry test that reproduces main's HELP byte for byte, beside the two expected failures for the unlisted commands.

**Why.** That line belongs to main's HELP; only the added commands' own lines and sections may differ.

**Result.** 4 of 51 failed; the shared line was put back, the two commands were added to the test's list of added commands and to its writes table, and the test passes, 51 of 51. The audit commands' help sections say "on this machine only; never --server" instead.

**Consequence.** None.

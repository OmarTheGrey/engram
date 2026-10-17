---
date: 2026-10-17
author: omar
type: decision
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - AGENTS.md
  - docs/tasks/step-0.md
  - .pi/APPEND_SYSTEM.md
supersedes: none
---

**What.** The lead removed the PR size limit: AGENTS.md rule 10 no longer caps a PR at 400 changed lines or asks for a card to be split first, and the card prompt pattern no longer says "Keep the diff under 400 lines".

**Why.** The limit was forcing cards such as S0.3 (518 changed lines, mostly tests) to be split into halves that are not useful on their own.

**Result.** Rule 10 now reads "One task card per PR. Title is the card id and its goal." The same sentence is gone from `docs/tasks/step-0.md` and `.pi/APPEND_SYSTEM.md`.

**Consequence.** One card per PR still holds; reviewers judge size case by case.

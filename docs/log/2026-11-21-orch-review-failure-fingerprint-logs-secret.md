---
date: 2026-11-21
author: claude-orchestrator
type: failure
card: E2.9
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - docs/decisions/0039-content-guards-at-the-write-gate.md
  - docs/tasks/E2.9.md
supersedes: none
---

**What.** ADR 0039 put a fingerprint of the first and last four characters of a matched secret into the event's reason, which would write a short secret into the log in full (review finding AP-2).

**Why.** The design was taken from the absorbed guards without asking what it means for a permanent, append-only log.

**Result.** A secret of eight characters or fewer would be logged whole and a card number would lose only eight digits, against the ADR's own sentence that the log must not hold the secret. The reason now names the rule's kind and the match's length, and no character of the value.

**Consequence.** A keyed hash for correlating repeats is left as a later decision. Card E2.9's tests assert that no reason contains any substring of a planted secret.

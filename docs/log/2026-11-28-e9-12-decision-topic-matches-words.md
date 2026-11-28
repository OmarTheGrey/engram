---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.12
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/consent.ts
  - docs/log/2026-11-28-e2-14-finding-consent-gaps-for-e9-12.md
supersedes: none
---

**What.** A topic matches the content's whole words: NFKC, invisible code points removed, lower case, words of letters, marks and digits, the topic's words consecutive within one string of the content (text, a record's key or value, a procedure's body or tool).

**Why.** E2.14's gap (a): items have no topic field, and adding one is a schema change the plan forbids. Matching had to be deterministic and explainable.

**Result.** "health" matches "Health insurance" and "h\u200Dealth", not "healthy". Stated evasions: plurals, an accent inside a word, compounds and camelCase, glued digits, split letters, homoglyphs NFKC keeps, a topic split across writes, lower case short of case folding.

**Consequence.** Consent is a control a cooperative writer meets, not a filter against an adversary; ADR XXXX records the choice for the lead.

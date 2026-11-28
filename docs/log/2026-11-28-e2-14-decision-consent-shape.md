---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.14
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/schema.ts
  - docs/tasks/E9.12.md
  - research/engram_types/Policy.py
supersedes: none
---

**What.** `consent` is `{ opt_outs: [...] }`, each opt-out naming a person scope (`person:<id>`) and optionally a `topic`, a provenance `source`, a window (`since` inclusive, `until` exclusive) and `except_topics`.

**Why.** E9.12 says a person opts out of a topic, a source, or everything for a window, with EverOS's carve-outs. The first draft named the fields `from` and `except`; both are Python keywords, so the generated `OptOut` became a functional TypedDict, and the names were changed.

**Result.** `OptOut` and `Consent` in the schema; the generated Python type is a plain class.

**Consequence.** E9.12 decides how a topic matches content; the schema only carries it.

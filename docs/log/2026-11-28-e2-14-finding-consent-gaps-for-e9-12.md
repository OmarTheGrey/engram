---
date: 2026-11-28
author: claude-agent
type: finding
card: E2.14
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/schema.ts
  - docs/tasks/E9.12.md
supersedes: none
---

**What.** The `consent` block leaves E9.12 three gaps. (a) Items have no topic field, so `topic` and `except_topics` must match content; a topic field on MemoryItem would be a persisted change and a version bump, which the plan forbids. (b) `source` is a provenance kind, as in `WriteRule.allowed_sources`, so an opt-out from one actor (Claude Code, say) cannot be written; that would be a second schema pull request. (c) Opt-outs sit in a policy document a team authors, while the card says a person declares them, and nothing records who declared one.

**Why.** The review of 2026-11-28 (finding 8) listed them; none blocks the schema.

**Result.** Recorded for E9.12; the schema is unchanged by them.

**Consequence.** E9.12 decides topic matching and declaration authority, the latter possibly in an ADR, and says whether an actor-scoped opt-out is needed before it builds.

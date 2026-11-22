---
date: 2026-11-21
author: claude-agent
type: decision
card: E9.8
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/cli/src/import/bundle.ts
  - docs/log/2026-11-21-e2-7-finding-gh-39-surfaces.md
  - docs/decisions/0040-trust-floors.md
supersedes: none
---

**What.** The import actor is named `import:<importer id>`, at the importer's level, a member of exactly the importer's scopes, and its source `import` is set by the CLI, never read from a bundle.

**Why.** The card asked how the actor is named and attested, against card E2.7's surface list and ADR 0040's HTTP limit.

**Result.** In process the CLI is the harness, as for `engram write` (E2.7: the CLI sets its own sources), so the attestation holds as far as the machine does (ADR 0026, P5-2). Over `--server` the actor is self-asserted like every HTTP client, the open path E2.7 found; ADR 0040's floor does not reach it, card E8.12 does. Its id names who it imports for, so the log tells imports from the importer's own writes.

**Consequence.** Card E8.12 should map an authenticated importer to this actor.

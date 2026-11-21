---
date: 2026-11-21
author: claude-orchestrator
type: failure
card: E2.11
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - docs/decisions/0040-trust-floors.md
  - docs/tasks/E2.11.md
  - packages/server/src/routes.ts
supersedes: none
---

**What.** ADR 0040 and card E2.11 said every surface in the repository declares its source; the HTTP API does not (review finding AP-1).

**Why.** The sentence was written from the comment on `withPlaneProvenance`, which names the pi extension, the CLI and adoption, without opening the server's routes.

**Result.** The ADR and the card now name which surfaces set a source, state that HTTP callers choose their own, and say that the floor reaches only callers that send none. Card E2.7 lists each surface with file and line instead of assuming the list.

**Consequence.** A claim about every surface is checked surface by surface before it is written. See the finding entry on the HTTP source.

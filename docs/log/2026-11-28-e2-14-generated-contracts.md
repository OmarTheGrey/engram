---
date: 2026-11-28
author: claude-agent
type: change
card: E2.14
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - sdk/schema/Policy.json
  - sdk/openapi.json
  - research/engram_types/Policy.py
  - make api-check
supersedes: none
---

**What.** `make api` regenerated the Policy JSON Schema, the OpenAPI document, the TypeScript clients in `sdk/ts` and `packages/ui/src/api`, and the Python `Policy` type with the new options.

**Why.** Every reader of the policy ships in this repository and must accept what core accepts (ADR 0002, decision D2's cost).

**Result.** Five generated files changed, additions only (505 lines); `make api-check` exits 0. No surface lists policy fields: the TUI's policy screens (`packages/cli/src/tui/screens/policy.ts`) show retention, lint and simulate answers, so no frame golden moved.

**Consequence.** Nothing for the surfaces until a consuming card builds its option.

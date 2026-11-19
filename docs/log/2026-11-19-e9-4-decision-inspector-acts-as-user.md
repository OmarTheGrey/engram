---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/ui/src/data.ts
  - packages/ui/test/twin.test.ts
supersedes: none
---

**What.** The inspector's grants editor calls `POST /grants` as the viewer with source `user`, and no MCP tool or pi tool exposes grant changes.

**Why.** The viewer `engram serve --as` names carries no source (ADR 0027's amendments), and the gate refuses a grant change from an actor that is not user-sourced. A person at the inspector is a user as much as one running `engram write`, which sets `user`; the actor is self-asserted either way until authentication. An agent's actor is model-sourced, so an agent tool would only ever be refused.

**Result.** A viewer without a source changes a grant through the editor (`packages/ui/test/twin.test.ts`).

**Consequence.** Until authentication, anyone who can reach the loopback server can change grants as any viewer, as they can already write as one.

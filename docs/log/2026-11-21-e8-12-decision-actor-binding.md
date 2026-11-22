---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.12
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/auth.ts
  - docs/decisions/0042-verified-actors.md
supersedes: none
---

**What.** On an authenticated call, the request's actor must name the credential's id and level. It may narrow its memberships, and its source is replaced. The operator states every credential's source; there is no default.

**Why.** The card left open how the body's actor and the credential meet. Replacing the body silently would hide a client's mistake, and requiring equality would stop a reader narrowing its scopes.

**Result.** Another id, level or membership gets 403 `forbidden_actor`. A key or subject entry without a `source` is refused when it is created or loaded.

**Consequence.** One credential is one actor in one capacity, so a person reading as person and as role holds two keys.

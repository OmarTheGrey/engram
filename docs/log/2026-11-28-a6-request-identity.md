---
date: 2026-11-28
author: claude-agent
type: finding
card: A6
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - docs/decisions/0035-store-independence-is-a-design-property.md
  - packages/adapters/test/plane/acceptance.test.ts
  - packages/runner/src/stores.ts
supersedes: none
---

**What.** The card asks for ADR 0035's request-identity check, which no card has built; the adapter passes the nearest check there is instead.

**Why.** ADR 0035's check replays a configuration on every store from cassettes; it needs the runner to open each store, and the runner opens fake, mem0 and letta only.

**Result.** `packages/adapters/test/plane/` requires the plane's events to be identical on every registered store, apart from the store_ref; all 310 of its and the files and Letta tests pass with mcp-memory registered. The runner's `STORES` is unchanged, so no registered config can name the store.

**Consequence.** When the request-identity check is built, mcp-memory joins it with one runner entry.

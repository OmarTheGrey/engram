# RD1 A read reveals no more than the reader may see: grants and lineage ids

Status: done on branch rd1-read-disclosure, awaiting review. Paths: packages/core/src/visible.ts, packages/core/src/plane/read.ts, packages/core/src/plane/promote.ts, packages/core/src/plane/export.ts, packages/core/src/plane/who-can-read.ts (comment), packages/core/src/plane/commit.ts (removedGrantsNote), packages/core/src/supersede.ts (writeClosures, review finding 6), packages/server/src/routes.ts, packages/view/src/view.ts (shownGrants, review finding 5; main moved packages/ui/src/view.ts there), packages/cli/src/tui/screens/grants.ts and rich.ts (the TUI's grants label), packages/ui/test/view.test.ts, packages/ui/test/twin.test.ts, packages/core/test/unit/plane/supersede.test.ts, packages/server/test/supersede.test.ts, packages/core/test/counterexamples/read-disclosure.test.ts, packages/core/test/property/invariants.test.ts, packages/server/test/read-disclosure.test.ts, packages/cli/test/read-disclosure.test.ts, packages/mcp/test/read-disclosure.test.ts, docs/decisions/0034-grant-change-is-the-owners-governed-write.md (amendment), docs/architecture.md, docs/tasks/backlog.md, docs/log/2026-11-25-rd1-*, docs/log/2026-11-27-rd1-* (review fix pass).

From the lead's request of 2026-11-25 ("accept the adrs and resolve the open items"). Lane: plane. Week: W14. Effort: M. Read AGENTS.md, `docs/architecture.md` ("Read path"), ADR 0034 (decision 9) and ADR 0047 before starting.

Goal: Every answer core gives an actor shows of an item only the grants and the lineage ids that actor may see, decided once in `packages/core`, so the CLI, the HTTP API, MCP, the pi extension, the inspector and the TUI on branch `cliupgrade` agree.

Why: Two open items. Lead-decisions item 36, decided (a) on 2026-11-20: a non-owner sees only the grants that name them, in core; today `Plane.read` gives a grantee every grant on an item, and only the inspector's `shownGrants` hides them (`docs/log/2026-11-22-e2-13-finding-leaks-outside-the-card.md`). And card E8.15c's finding on `cliupgrade` (`docs/log/2026-11-23-e8-15c-finding-json-lineage-route.md` on that branch): `engram read --json`, and so the TUI's `J` view, names lineage ids the reader may not read, which the inspector's leak rule (`packages/ui/src/provenance.ts`) already keeps off the item page.

Steps:

1. Tests first, in the counterexample style: dana owns an item granted to sam and to eve; sam's read shows only his grant, eve's only hers, dana's both; a member of the item's scope who is neither owner nor grantee sees none. An item whose ancestor sam cannot read: sam's read names no ancestor id, over core, the CLI's `--json`, the HTTP route and MCP. Mutation-check each.
2. One rule in core (`packages/core/src/visible.ts`): the grants and the lineage an actor is shown of an item. The owner (its id is the item's owner and it may read the item's scope, as `Plane.changeGrants` and `whoCanReadItem` know it) sees every grant; anyone else only the grants whose `to` names it. A lineage id is shown only when ADR 0047's by-id rule would let the actor ask for it: its item is in a scope the actor may read, or the read filter admits it at the read's time.
3. Apply it on every core path that returns an item or names its grants to an actor: `Plane.read` and `Plane.readById` (items, and each explanation's `grants_used` renumbered to the grants shown, which `explain` returns as stored), `visibleEvents` (each shown item, and a grant change's reason), `Plane.promote`, the bundle export, and the supersede route's submitted closes and writes. Retention events carry no item state, so `Plane.retain` and a write's retention events need nothing.
4. Prove no registered byte moves: the MANIFEST rows the change can reach, the fixtures' tests, `make test-invariants`.

Files: packages/core/src/visible.ts, packages/core/src/plane/read.ts, packages/core/src/plane/promote.ts, packages/core/src/plane/export.ts, packages/core/src/plane/who-can-read.ts (comment), packages/core/test/, packages/server/src/routes.ts, packages/server/test/, packages/cli/test/, packages/mcp/test/, packages/ui/src/view.ts (comment), docs/decisions/0034-grant-change-is-the-owners-governed-write.md (an amendment), docs/architecture.md, docs/tasks/RD1.md, docs/tasks/backlog.md, docs/log/

Depends on: E2.13, E8.14, E9.4, RV7 (all merged)

Decision: what a member of the scope who is neither owner nor grantee sees (the card settles it in a `decision` entry); how an unreadable lineage link is shown (dropped or counted).

Acceptance: `make test-one T=packages/core/test/counterexamples/read-disclosure.test.ts`, with the server, CLI and MCP disclosure tests, and `make test-invariants`

Risks: a registered run's prompt or cassette key carrying grants or lineage from a read answer; none does (the memory tag carries id, scope, rank, rule and content only), and the card proves it.

Out of scope: `packages/core/src/schema.ts` (only card E2.8 edits it), a count of hidden links (it would need a schema field), the TUI on `cliupgrade` (a `finding` entry says what it must follow), the owner named in a grant-change refusal (E2.13's second finding).

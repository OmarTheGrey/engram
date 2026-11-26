# @engram/ui

The inspector: a browser view of one workspace as one viewer, served by `engram serve` at `/` beside the API (cards E8.5, E8.6, E9.4, E8.11 and E2.13). React 19 and Vite. Back to the [root README](../../README.md).

## Rules

- **Every call goes through the generated client** (`src/api/`, written by `make api`; never edit it) to the server's API, and to nothing else.
- **No policy is decided here** (AGENTS.md rule 1). The lanes are what `Plane.read` returned to the viewer, the event table is what `visibleEvents` gave the viewer, who can read an item is what `Plane.whoCanReadItem` answered, the explain view's counts are core's, and a grant change is decided by `Plane.changeGrants`. The view code only groups, filters what is already visible, reads a form and labels.
- **Viewing is reading.** The lanes are a real read as the viewer, so they pass the read filter and leave a read event.
- **A viewer who is not an item's owner sees only the grants that name it.**

## What it shows

- **Scope lanes**, grouped into the viewer's person scope, its role scopes, its team and org scopes, and what it reached through a grant; each item with its grants.
- **The event table** of the events the viewer may see (card E8.11, in place of the earlier timeline): sortable by any column, filtered by operation, decision, actor and scope, and virtualised, so tens of thousands of events stay fast; selecting an event shows its detail.
- **The item page** (card E8.11), at `#/item/<id>`: the item's provenance and decision graph, a diff between two versions with the event that made the later one, and the events naming it. No node appears for an item the viewer cannot read.
- **Who can read this** (card E2.13), on the item page: each reader with the rule or grant that admits them, as the plane answered; grant holders are named to the owner only.
- **Explain**: for a read the viewer made, which items came back with their score components and admitting rule, and how many were filtered and why. Another actor's read shows its event and says only its reader may explain it.
- **The grants editor**, in scopes the viewer is a member of: add or remove a grant; the plane decides, and the editor shows the decision with its rule and reason.

## Main modules

| module | what it holds |
|---|---|
| `src/App.tsx`, `src/main.tsx`, `src/style.css` | the screens |
| `src/data.ts` | what the inspector asks the server: `inspect`, `fetchExplain`, `fetchViewer`, `changeGrants` |
| `src/view.ts`, `src/provenance.ts` | one-line re-exports of [`@engram/view`](../view/README.md), which holds the pure functions from what the API returned to what each view shows (card E8.15c); the paths stay because log entries cite them |
| `src/api/` | the generated client and types (do not edit) |

The item page (card E8.11) is `src/ItemPage.tsx`, `src/ProvenanceGraph.tsx` with `src/layout.ts`, `src/TextDiff.tsx` with `src/diff.ts`, and `src/EventTable.tsx` (TanStack Table and Virtual); the who-can-read panel is `src/WhoCanRead.tsx` (card E2.13).

## Use

```sh
make ui                     # builds into packages/ui/dist
engram serve --root <store folder> --owner alice --insecure-loopback --as person:alice --member person:alice
# then open http://127.0.0.1:7313/
```

`--as` names the viewer the inspector starts from; the viewer picker can change it.

## Test

```sh
pnpm --filter ui exec vitest run       # data.ts and view.ts, through the client in process, on fixture workspaces
pnpm exec playwright install chromium  # once
make test-e2e                          # runs make ui itself, then the inspector in Chromium on fixtures/workspaces/inspector and fixtures/workspaces/twin
```

## What is next

- Open roadmap cards, not started: E8.7 (lint findings with resolve actions), E8.10 (a diff between two snapshots of a scope), E9.3 (Knowledge screens) and E9.6 (Procedures screens).
- From the second absorb plan ([`docs/tasks/absorb-plan-2.md`](../../docs/tasks/absorb-plan-2.md)), none merged yet: E8.8, rewritten to carry approvals on every surface and the inspector's queue, after the approval queue in core (E2.19); and E2.17, why an item was not returned (the first rule that excluded it).

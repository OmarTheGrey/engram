# @engram/view

The pure view logic the inspector (`packages/ui`) and the terminal interface (`packages/cli/src/tui`) both show: from what the API returned to the viewer, to what each view draws (card E8.15c, `docs/design/tui.md` 6.3). Back to the [root README](../../README.md).

## Rules

- **No policy is decided here** (AGENTS.md rule 1). The lanes are what `Plane.read` returned, the timeline is what `visibleEvents` gave, the explain view's counts are core's, a grant change is the plane's decision. These functions group, filter what is already visible, read a form and label.
- **Only the generated client's types.** The one import is `import type` from `@engram/sdk`, so a package that depends on this one gains no React, xyflow, dagre or tanstack. `packages/cli/test/view-deps.test.ts` holds the CLI to that.
- **The leak rule lives here once.** An id a lineage names becomes a node only when the server gave the viewer something of that item itself; otherwise it leaves no node, no edge and no count (`provenance.ts`, card E8.11).

## Main modules

| module | what it holds |
|---|---|
| `src/view.ts` | the viewer picker, scope lanes and their groups, the grants editor's draft and labels, the timeline's filters and event detail, the explain view, the who-can-read rows |
| `src/provenance.ts` | the item page: the items the viewer may see, the provenance graph, the versions to diff, the events naming an item |

`packages/ui/src/view.ts` and `provenance.ts` are one-line re-exports of this package, kept because immutable log entries cite them; the functions' tests stay in `packages/ui/test/` for the same reason.

```
pnpm exec vitest run packages/view packages/ui
```

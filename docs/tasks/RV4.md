# RV4 Adoption: never raise trust, never widen grants, recover after a folder move

Status: done on branch rv4, awaiting review. Paths: `packages/core/src/plane/adopt.ts`, `packages/core/src/plane/write.ts` (`adoptedItem`, `refHolders`, `Adoption.vacated`), `packages/core/src/plane/commit.ts` (`sameAsWritten`), `packages/core/src/events.ts` (`erasedScopeContent`), `packages/core/src/plane.ts` (export), `packages/core/src/dogfood.ts` (rule list, comment); tests `packages/adapters/test/plane/rv4-files.test.ts` (the acceptance), with `packages/adapters/test/plane/rv3-files.test.ts`, `packages/adapters/test/plane/grants-files.test.ts`, `packages/core/test/unit/dogfood-report.test.ts`, `packages/core/test/unit/plane/adopt.test.ts`, `packages/core/test/unit/plane/cross-handle-verify.test.ts` and `packages/core/test/unit/plane/write-grants.test.ts` updated; ADRs 0004, 0007, 0010, 0013, 0021 and 0034 amended (proposed); `docs/dogfood.md`; `docs/tasks/backlog.md`; `docs/tasks/E9.5.md` (status line).

From the reviews, not from `docs/roadmap.md`: three adoption defects in core that cards E9.5 and RV3 found and deferred until card E2.6, which rewrote `adopt.ts` and `write.ts`, merged (`00c606e`). The twin dogfood (card E9.5) runs on the files adapter and adopts before every read, so these fixes protect it; the first was one of its preconditions. Read AGENTS.md, ADRs 0004, 0007, 0010, 0013, 0021 and 0034 with their amendments, and `docs/dogfood.md` before starting.

Goal: adoption never raises an item's trust and never widens what its grants admit, and a moved files folder adopts under its new ids, with the old ids retired, nothing lost or brought back, and erased content kept refused.

Files: packages/core/src/plane/, packages/core/src/events.ts, packages/core/src/plane.ts, packages/core/src/dogfood.ts, packages/core/test/, packages/adapters/test/plane/, docs/decisions/0004, 0007, 0010, 0013, 0021 and 0034, docs/dogfood.md, docs/tasks/backlog.md, docs/tasks/E9.5.md

Depends on: E2.6 (merged as `00c606e`), RV3 (merged), E9.5 (merged)

Acceptance: `pnpm exec vitest run --root packages/adapters test/plane/rv4-files.test.ts` and `make test` pass, with a committed test for each defect:

1. Adoption raises trust (backlog row "Adoption raises trust"): an agent-written item re-adopted keeps `model` and the owner's grant on it is refused; an unchanged plane-written record adopts with no event; a record edited by hand adopts as `import` at most, never as more trusted than it was. The dogfood report's `watch.provenance_raised` is 0 on its realistic synthetic log.
2. Adoption carries grants on a record the plane never wrote (RV-ADP-4): the reviewer's forge probe adopts without its grant to Mallory, who reads nothing; the owner's grant change through the plane, re-read from the store, keeps its grants.
3. Adoption after a folder move (backlog row of card RV3): adopt, move, adopt again: the new ids are adopted and the old ones retired; an erased file stays refused across the move.

Out of scope: the surfaces' findings, including the server's read path (`packages/server/src/routes.ts` `syncStore`), which card RV5 takes in parallel; `packages/server`, `packages/pi-extension` and `packages/pi-package` are not edited. ADR 0010's open question V4-6 (an appended left-in-store file adopted under its erased id) is unchanged. No schema change (AGENTS.md rule 5); the invariants file is not touched.

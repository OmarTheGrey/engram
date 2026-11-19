# RV3 Repository review: the files adapter and the no-bypass path check

Status: in progress on branch rv3.

From the repository review of the adapters (findings RV-ADP-1 to RV-ADP-10), not from `docs/roadmap.md`. The files adapter is the store the twin dogfood (card E9.5) runs on, so these fixes protect the dogfood. Read AGENTS.md, ADR 0013, ADR 0014 and ADR 0028 before starting.

Goal: the files adapter ties an item's id to its file name and its owner, keeps Engram items out of Claude Code's MEMORY.md, and marks every permanent delete refusal as a `NotDeletableError` (the Letta adapter too); the no-bypass path check maps the remaining loopback UNC spellings and Letta Code's package spec; tests kill the review's surviving mutants M1, M10 and M11.

Files: packages/adapters/src/files/, packages/adapters/src/letta/index.ts, packages/adapters/src/mem0/index.ts (header comment only), packages/adapters/test/, packages/core/src/no-bypass/, packages/core/test/unit/no-bypass.test.ts, packages/mcp/test/hook.test.ts, packages/pi-extension/test/, packages/cli/test/write.test.ts, docs/decisions/0013, 0014 and 0028, docs/dogfood.md, docs/tasks/backlog.md

Depends on: A1, A2, A3, E8.4 (all merged)

Acceptance: `pnpm exec vitest run --root packages/adapters` and `make test` pass, with a committed test for each finding fixed (RV-ADP-1, 2, 3, 5, 7, 8, 10) and for mutants M1, M10 and M11

Findings fixed: RV-ADP-1 (an Engram file whose key is not `<id>.md` is refused), RV-ADP-2 (an imported file's id derives from its owner and key), RV-ADP-3 (Engram items are never indexed in MEMORY.md), RV-ADP-5 (permanent delete refusals are `NotDeletableError`, in the files and Letta adapters), RV-ADP-7 (loopback UNC spellings), RV-ADP-8 (Letta Code's package spec), RV-ADP-9 (docs: a ref after a delete), RV-ADP-10 (Mem0 header; stale temporary files cleaned at open).

Out of scope: RV-ADP-4 (adoption carries grants from a dropped file: core's `adopt.ts`, which card E2.6 rewrites; card RV4 after E2.6 merges) and RV-ADP-6 (what `search` means across stores: the lead's decision). Both are backlog rows. No schema change (AGENTS.md rule 5).

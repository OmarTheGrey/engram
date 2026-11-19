# RV7 Core review: owner rules, event visibility and the shell no-bypass check

Status: open, on branch rv7.

From the core review (findings RV-CORE-1, 2 and 4 to 10, on main `00c606e`), not from `docs/roadmap.md`. RV-CORE-3 (the caller picks the read time) is card RV5's. Read AGENTS.md, ADRs 0006, 0009, 0014, 0021 and 0034 with their amendments before starting.

Goal: a grant on an item reads as its owner's consent to what the item says, and only the owner moves an item to another scope; an event is shown to a member of its scope only when the read matrix lets that member read the scope; the shell no-bypass check follows `cd`, `pushd` and `-C` within a command, judges recursive walks over an ancestor of a root, and reads `~user`; the property tests cover a grant naming the reader under `honour_grants: false` and a non-null `valid_to`.

Design rule (the lead's, for RV-CORE-1 and 2): narrow, never widen. A rewrite of an item that carries grants is the owner's only; only the owner changes an item's scope. The owner's own rewrite and move, the handover to a successor, promotion, and adoption by the owner keep working.

Files: packages/core/src/policy/evaluate.ts, packages/core/src/policy/promotion.ts (comment and the in-place call), packages/core/src/visible.ts, packages/core/src/no-bypass.ts, packages/core/src/no-bypass/paths.ts, packages/core/test/ (unit, property, generators), packages/adapters/test/plane/ (a reproduction), docs/decisions/0006, 0009, 0014 and 0034 (amendments, proposed), docs/tasks/backlog.md

Depends on: E9.4, E9.7, E2.6, E8.4, RV3 (all merged)

Acceptance: `make test` and `make test-invariants` pass, with a committed test for each finding fixed (RV-CORE-1, 2, 4, 5, 6 and 7) that fails on main

Findings: RV-CORE-1 (a co-holder rewrites a granted item), RV-CORE-2 (a co-holder moves the owner's item), RV-CORE-4 (event visibility past the read matrix), RV-CORE-5 (shell paths a `cd` makes relative, recursive walks, `~user`), RV-CORE-6 and 7 (property test gaps), RV-CORE-8 (the confidence floor gates a number the model picks: a finding and a backlog row, no change), RV-CORE-9 (a redundant promotion check, kept as defence in depth), RV-CORE-10 (version 0 store records: reproduced, backlog row widened).

Out of scope: RV-CORE-3 (card RV5); `packages/core/src/plane/adopt.ts` (card RV4); the read-time code (`actor.ts`, `plane/read.ts`, the server routes, the pi extension, the MCP transports: card RV5). No schema change (AGENTS.md rule 5).

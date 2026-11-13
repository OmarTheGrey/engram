# ADR 0010: Retention never deletes; eviction retires; long-horizon arm is mandatory

Status: accepted, 2026-11-02
Deciders: Omar (lead)
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

Ground Truth First's tenure crossover (budgeted memories win at three weeks and lose at nine because eviction removed old material); MemSecBench's finding that selective repair damages benign memory.

## Decision

Retention budgets per scope trigger `retire` events, never deletes; retired items stay replayable and can be reinstated by event. Hard deletion exists only for person-scope erasure and emits a deletion report. The evaluation includes a long-horizon arm so the cost of eviction appears.

Amendments made when implementing card E2.4, 2026-10-29:

- The mechanism is ADR 0025 (`docs/decisions/0025-retention-semantics.md`): expiry retires with op `retire`, budget overage with op `evict` in the rule's order (recency, utility, manual), both decided by the pure `evaluateRetention` (packages/core/src/policy/retention.ts) and appended by `Plane.retain` and the write path's budget check (packages/core/src/plane/retention.ts). "Never deletes" holds in both places it could fail: the event sets the projected status to retired, and the plane never writes or deletes the item in the store, so the store keeps the bytes and adoption leaves an item retired by retention retired while the store has it unchanged (ADR 0007's adoption amendment).

Amendments made by card E9.7, 2026-11-06 (branch `e9-7-offboarding`):

- The person-scope erasure is implemented by `offboard` (packages/core/src/plane/offboard.ts). Every item in the person scope, every version and status, is deleted from the store, its projection and explanation rows are removed, and its content, provenance ref and evidence hash are redacted in every earlier event that carries it; one `retire` event per item under `engram/offboard/erase` (events.ts `ERASURE_ID`) then removes it from the projection and from replay (`itemsAt`), so a rebuilt projection equals the incremental one and the item never comes back from the log (`packages/core/test/replay/erasure.test.ts`). The redaction is the one rewrite of the append-only log (ADR 0003): without it the log would keep what erasure deletes. The events, their ids, decisions and reasons stay, so what was decided remains auditable.
- The deletion report names what was erased and handed over by id, the store refs deleted and any the store failed to delete, and what the call cannot reach: a store's own history (`native_history`, such as Letta's git), pi session files that mirrored the events, and backups. It carries no content. One summary event (`engram/offboard/report`) records the offboarding.

Amendments made in the review of PR #33, 2026-11-13:

- Erasure deletes a store ref only when no item outside the person scope holds it. A ref shared with such an item (a version of the same store record, as adoption makes) is kept in the store, since deleting it would delete that item's bytes; the erased items' copies in the log are redacted all the same, and the deletion report names how many refs were kept (`packages/core/test/unit/plane/offboard-edges.test.ts`).

Amendments made by the post-merge integration fixes, 2026-11-13 (the review of the twelve PRs merged that day):

- A store's delete failure is either transient or permanent. A permanent refusal is a `NotDeletableError` (packages/core/src/adapter.ts, part of the Adapter contract; the files adapter's `ReadOnlyItemError` for a memory file Engram did not write is one), so core tells the two apart with no store-specific branch.
- On a transient failure the item is not erased in that run: it stays in the store, the projection and the log, unredacted, with one deny event (`op` retire, `engram/write/store-failure`, the reason naming the error and `engram/offboard/erase`), and the deletion report lists it under `store_failures` with its ref and items. Offboarding again once the store recovers erases it. Erasing it from the log while its bytes stayed in the store let adoption bring it back with nothing recording why.
- On a permanent refusal no rerun would succeed, so the item is erased from the projection and the log as any other, and the report lists its ref under `left_in_store` for the person to delete in the store. Adoption skips an id an erase event erased, so the record left behind is not brought back (`packages/adapters/test/plane/offboard-files.test.ts`, over the Claude Code memory fixture).
- Each erase event's reason says what happened to its item in the store: deleted, left in the store that refuses the plane's delete, kept because an item outside the person scope holds the same ref, or no store record.
- The redaction reaches lint events (card L1), which carry an item by id only and their evidence in `reason`. A lint event is redacted when it is about an erased item (its `item_id`), or when its reason names an erased id, or holds a content or evidence hash of an erased version that no surviving item also holds (as its content hash or its provenance hash). An erased item's evidence hash of a source that survives is never matched. A hash a survivor holds stays readable in that survivor, so redacting by it protected nothing and erased findings about surviving items (review of PR #41). A redacted lint event keeps its lint id, severity and rule, and its reason becomes `<lint_id> (<severity>): [erased]`. A lint event changes no item, so replay and a rebuilt projection are unchanged (`packages/core/test/unit/plane/offboard-edges.test.ts`, on SQLite and embedded Postgres).

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks E2.5, X9, Twin erasure. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)

# ADR 0032: The simulator replays recorded calls through the plane on scratch logs

Status: proposed, 2026-11-06 (card E8.9, branch `e8-9-simulator`)
Deciders: drafted by card E8.9; for the lead's acceptance
Supersedes: nothing; it replaces the `Workload` and `SimReport` stubs card E0.3 declared in `packages/core/src/simulate.ts`.

## Context

Card E8.9 asks for a simulator that replays a recorded workload under a policy and reports a utility proxy and evictions, with a fixture workload under two presets printing a comparison. Card E0.3 had declared the workload as `{ id, events }`, the events of a run or a converted pi session, and the report as one recorded decision beside one simulated decision per event.

Events alone cannot be decided again under another policy:

- A denied write's event carries no item (`checkConsistency` in `packages/core/src/events.ts` requires an item only on an allowed change), so a write strict denies could never be tried under permissive.
- A read's event carries its counts, not its query, so no read could be run again.
- An event names its actor's id, not the actor's level, memberships or source, which the write gate and the read filter decide on.
- Utility eviction counts explanation rows, which the log does not hold (ADR 0025, finding P4-5).

The inspector's fixture (`fixtures/workspaces/inspector/workload.json`, cards E8.5 and E8.6) and the Gate B replay workload (`packages/adapters/test/plane/replay-workload.test.ts`) already record a workload as actors and steps.

## Decision

1. **A workload is the plane calls a run made**: `{ id, description?, actors, steps, retrieval? }`, each step `write` (the item as sent), `read` (the query text), `retain` (the scope) or `promote` (item, target, review), made as the actor its `as` names at the time its `at` names. The Zod shape is `Workload` in `packages/core/src/simulate.ts`; the HTTP contract and the generated client reuse it.
2. **Each policy replays the workload through the plane's own code**, `gatedWrite`, `filteredRead`, `retain` and `promote` (`packages/core/src/plane/simulate.ts`), on its own in-memory SQLite log and an in-memory store with no search, with event ids from a counter. Nothing is copied from the gate, so the simulator cannot drift from it, and the same workload gives the same report.
3. **`Plane.simulate(workload, candidate)` compares two runs**: the plane's own policy (the baseline) and the candidate. The report carries, per policy, each step's outcome, the totals, the utility proxy and the evictions, then every step whose decision, returned items or retirements differ. The deciding rule's id is not compared, since it names its policy.
4. **The utility proxy is the recall reads got**: items returned, reads that returned any, and the mean per read. ADR 0025 already names reads-returned as the deterministic proxy, after MERIT's marginal-utility framing (2609.05441); it counts recall, not whether the recall was right.
5. **The simulator never reads or writes the plane's own log, projection or store.** A replay starts empty, so a workload carries the writes its reads depend on. What it reports comes from the workload alone, which is why invariant 1's surface check classifies `simulate` as handing no caller an item it cannot read.
6. **Surfaces record steps, not events.** The pi extension and the MCP server push a step for each plane call they make; `memory_simulate` takes an optional candidate preset. `engram simulate --workload <file> --policy <baseline> --candidate <policy>` prints the comparison, or the report with `--json`.

## Alternatives considered

- **Keep `{ id, events }` and re-decide what events allow** (allowed writes only, actors inferred from what they wrote): every denied write and every read is lost, so a stricter and a looser preset could not be compared, which is the card's acceptance.
- **Put the missing fields on the events** (the denied item, the query, the actor's memberships): a schema change (AGENTS.md rule 5) that would also put a denied item's content, and the actor's memberships, into every audit record and pi session. The returned item ids on read events are the next schema PR's (backlog), and help log replay, not re-decision.
- **Evaluate with the pure evaluators over a projection the simulator keeps** (`evaluateWrite`, `evaluateRead`, `evaluateRetention` by hand): no scratch database, but a second copy of the write path's order of checks, budget slots and promotion evidence, which would drift.
- **Start from the plane's current state**: closer to "what would this policy do here", but the report would then carry items of the real log, and the caller's reach into it would need the read filter's whole reasoning again.

## Consequences

- `SimReport` is typed in the OpenAPI document (`sdk/openapi.json`), and `/simulate` no longer answers 501.
- Card PX2 converts a pi session JSONL into a workload of this shape; its expected decisions are the baseline run's.
- Reads replay on a store without search (the plane's term match) unless the workload or the plane names the core pipeline, so a run recorded on Mem0's search can rank differently in the replay. The decisions do not depend on it; the returned items can.
- A workload carries whole items and queries, so a recorded one is dogfood content when it comes from a member's session (AGENTS.md rule 12): it stays on that machine.

## Sources

- `docs/tasks/E8.9.md`, `docs/roadmap.md` (epic E8)
- ADR 0025, finding P4-5 and the alternatives (utility proxy)
- `fixtures/workspaces/inspector/workload.json`
- `docs/log/2026-11-06-e8-9-failure-workload-of-events.md`

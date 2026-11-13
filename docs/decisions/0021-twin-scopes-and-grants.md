# ADR 0021: Twin: person and role scopes, consent grants, handover; offboarding deferred

Status: accepted, 2026-11-02
Deciders: Omar (lead)
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

GateMem's shared-pool leaks; the 1,000 People paper (interview-grounded twins are measurable, and consent and deletion are design); PersonaMem (preferences supersede).

## Decision

Every person has a `person` scope (never readable by others without a grant) and a `role` scope (handed to a successor by event). Grants are explicit, scoped by class, and expire. Twin bootstrapping from an interview is a prompt template in the pi package. Offboarding with a deletion report stays on the kill list.

Amendments made in the review fix pass, 2026-10-25 (PR #5, findings R5-1 to R5-14):

- Decision D4 (finding R5-7, PR #5): the write gate denies (`engram/write/grant`) a grant to `*`, to a bare kind wildcard such as `person:*` or `agent:*`, or with a `*` anywhere but last (a pattern names a kind and a non-empty prefix, such as `agent:claude-code/*`); a grant without `class` or without `expires`, as this ADR requires; and any grant on model or compaction content. The Grant schema still marks `class` and `expires` optional, since changing it is a schema PR (AGENTS.md rule 5); the gate is where the requirement is enforced, and the read filter still honours a grant without them for items that never passed the gate.

Amendments made by cards E9.2 and E9.7, 2026-11-06 (branches `e9-2-twin-profile` and `e9-7-offboarding`; the lead assigned E9.7 off the kill list in the post Gate B plan):

- The twin profile (`packages/pi-package/profiles/twin.yaml`, card E9.2) encodes the split: a role context reads role, team and org and never a person scope; a role scope takes no episodic records and no model or compaction content; no grant exists by default.
- Offboarding is implemented (card E9.7, `offboard` in `packages/core/src/plane/offboard.ts`): each role scope the leaver holds is handed to its successor by one `update` event per item the leaver owns (`engram/offboard/handover`: owner becomes the successor, version plus one, rewritten to the store), and the person scope is erased (ADR 0010's amendment of the same day) with a deletion report. Reading the role stays a matter of membership, which the harness supplies. Only a user-sourced member of the person scope and of every role handed over may offboard; without authentication that holds as far as the machine does (ADR 0027).

Amendments made in the review of PR #33, 2026-11-13:

- A store failure while handing a role over is a decision with its own event: one `update` event of decision `deny` under `engram/write/store-failure`, naming the item and the handover, and the call throws before anything is erased. The items handed over before the failure stay the successor's, so offboarding again once the store recovers completes the handover and the erasure (`packages/core/test/unit/plane/offboard-edges.test.ts`).

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks E9.1 to E9.5. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)

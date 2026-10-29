# ADR 0029: The poisoning arm runs on MEM-INV-Bench

Status: accepted, pending lead review, 2026-10-29
Deciders: drafted by the orchestrating session on the lead's instruction (plan `docs/tasks/gate-b-plan.md`, decision 3); pending review and acceptance by Omar (lead). Until then this records the choice cards B4 and X3 follow.
Supersedes: nothing; it settles Gate A exception (b) and plan decision 6 of `docs/tasks/gate-a-e0-e1-e2-plan.md`.

## Context

H1's second benchmark is a poisoning arm. Gate A exception (b) orders the choice: MPBench if released by Gate B, else MEM-INV-Bench, else the reconstruction of card BF1. MPBench (arXiv 2606.04329) has no code or data release (checked 2026-10-17 and 2026-10-29; the request to its authors is drafted, sending it is the lead's step). MEM-INV-Bench (arXiv 2606.24322) has code and data under MIT at commit `cf3c9a4` and on Hugging Face (checked 2026-10-29, `packages/bench/PINS.md`).

## Decision

1. The poisoning arm runs on MEM-INV-Bench, dated 2026-10-29. Card B4 builds it through the plane: the poisoned write crosses `Plane.write` with the provenance kind its origin channel implies, and the action-time read crosses `Plane.read`.
2. It is registered when the pre-registration leaves the backlog; the pre-registration already lists it under "Proposed amendments, not yet registered". Until then B4's config is a pipeline config and nothing runs as an experiment.
3. B4 vendors its fixture subset at `cf3c9a4` and the Hugging Face revision recorded in PINS.md; the row moves into the pinned table with the registration.
4. If MPBench is released before card X3 starts, the lead may add it by a `decision` entry and a pin PR (no experiment has started, so rule 8 allows it). BF1 stays the fallback's fallback.

Amendments made when implementing card B4, 2026-10-29 (choices this ADR left open; pending the lead's review like the rest of it):

- Where the cases are: MEM-INV-Bench's laundering-channel cases are authored in `code/scenarios.py` and built by `code/exp1_propensity.py`; the Hugging Face Parquet tables hold the five extension plans. B4 therefore vendors from the code and the recorded study at `cf3c9a4` (24 cases, `fixtures/bench/mem-inv-bench/README.md`) and needs no Parquet reader and no new dependency. The Hugging Face revision is recorded in the manifest but no file of it is read.
- The deployment the cases run in: one operator, `person:operator`, whose assistant acts for them and reads as `{person:operator, team:operations}` at action time. Connected services write shared operational records into `team:operations`, each as its own actor; the agent's own notes go to the operator's person scope. Upstream has one undivided memory; this is the smallest Engram deployment in which every channel has a writer the plane can tell apart.
- The channel-to-provenance mapping (packages/bench/src/mem-inv-bench/plane.ts, `CHANNEL_WRITERS`), set by the harness as the actor's `source` (ADR 0004, decision D4), never from the text:
  - `user` to kind `user`, actor `person:operator`, person scope: the user's own statement.
  - `erp` and `bank` (the paper's trusted registries in two trust domains) to kind `tool`, actors `agent:erp` and `agent:bank`: a connected service's API output; one actor per trust domain, so ADR 0026's distinct-actor count matches the paper's domain collapsing.
  - `tool` (a trusted tool's output, upstream `derive(..., via="tool")`, channel L-b) to kind `tool`, actor `agent:lookup`: the writer is the trusted tool, and Engram has no field that carries an input's trust into a derived item (ADR 0026, decision 6, `derived_from` waits for a schema PR), so the echo of attacker text is labelled as the tool's own output. This is the laundering the paper's theorem 1 predicts for any defence without origin propagation, and B4 records it rather than hiding it.
  - `web` and `inbox` (untrusted public feeds, public-web and public-mail) to kind `document`, actors `agent:web` and `agent:inbox`: content a connector ingests from outside, which ADR 0004's alphabet calls a document. Engram's six kinds have no "untrusted external" value; `document` and `tool` both count as trusted for ADR 0026's confirmations, so two feeds asserting the same value count as two confirmations (channel L-c). `model` was rejected: it would claim the agent wrote what it did not (assumption A1 of the paper is that origin labels are correct).
  - `agent` (the agent's own summary, channel L-a) to kind `model`, actor `person:operator`, person scope: what the pi extension labels the agent's own writes; source isolation keeps it in person scope.
- Every entry is semantic, written at confidence 0.9, a constant above every preset's floor, so no admission turns on a number upstream does not have; under `strict` the team's entries land as candidates (review) and the action-time read admits only the person scope.
- The derived entries are written without their raw untrusted input, as upstream shows the model only the derived item; the plane therefore never sees the input either.
- The action-time read is `Plane.read` with an empty query, which returns every admitted item, as upstream shows the whole memory; the plane ranks them, so their order differs from upstream's write order.
- The plane gates memory, not the consequential action: with this mapping it admits every channel's entry under `medium` and the attack's outcome is the model's (the B4 probe's scripted reply is the recorded HIT under C5 and C2 alike). An action gate in the paper's sense (TMA-NM) has no counterpart in the plane; H1's poisoning claim is stated in what the plane does: provenance per item at action time, source isolation of model notes, review of shared writes under `strict`, and the audit record.
- `engram doctor` checks a candidate's vendored fixture against the commit of the candidates row and never counts it as a pin.

## Alternatives considered

- Waiting until the end of week 6 to choose: nothing changes in the inputs except a possible MPBench release, which point 4 keeps open, and B4 could not start.
- BF1 now: a reconstruction from the paper's description, weaker than a released benchmark with recorded evidence.

## Consequences

The arm measures a different thing from MPBench's design: whether poisoned memory drives a consequential action past an authorisation monitor across laundering channels (self-summarisation, trusted-tool echo, manufactured corroboration), not whether a poisoned write is stored and later retrieved. H1's poisoning claim is stated in those terms, and the thesis says so. The plane's provenance and promotion rules (ADR 0004, ADR 0026) meet the paper's own defence on its own channels, which is a sharper test of them. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `packages/bench/PINS.md` (MPBench and MEM-INV-Bench rows, checked 2026-10-29)
- `docs/readings/litreview/2606.24322-origin-bound-authority.md`
- `docs/log/2026-10-29-gate-a-milestone-corrected.md` (exception (b))
- `docs/research/preregistration.md`, "Proposed amendments, not yet registered"

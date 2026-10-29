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
- The channel-to-provenance mapping (packages/bench/src/mem-inv-bench/plane.ts, `CHANNEL_WRITERS` and `entryKind`), set by the harness as the actor's `source` (ADR 0004, decision D4), never from the text. A derived entry's kind is the least trusted of its channel's kind and its inputs' kinds (ADR 0004's "an item derived from others inherits the least trusted provenance of its inputs", in ADR 0026's trust order user, document, import, tool, model, compaction, through core's `leastTrusted`); the harness knows the inputs from the visible `derived_from` at the call boundary (review finding R6-3):
  - `user` to kind `user`, actor `person:operator`, person scope: the user's own statement.
  - `erp` and `bank` (the paper's trusted registries in two trust domains) to kind `tool`, actors `agent:erp` and `agent:bank`: a connected service's API output, one actor per trust domain.
  - `web` and `inbox` (untrusted public feeds, public-web and public-mail) to kind `document`, actors `agent:web` and `agent:inbox`: content a connector ingests from outside, which ADR 0004's alphabet calls a document. Engram's six kinds have no "untrusted external" value. `model` was rejected: it would claim the agent wrote what it did not (assumption A1 of the paper is that origin labels are correct).
  - `tool` (a trusted tool's output, upstream `derive(..., via="tool")`, channel L-b) is written by actor `agent:lookup` with the least trusted kind of `tool` and its inputs. Its input is a `web` document, and ADR 0026's order ranks `tool` below `document`, so the rule leaves the echo `tool`: inheritance cannot mark it untrusted, because no Engram kind ranks an untrusted external source below a tool. The rule does bite when a tool's input is model content (the echo is then `model`, and the team scope refuses it, `plane.test.ts`). This is the laundering the paper's theorem 1 predicts for a defence without an untrusted origin label, recorded rather than hidden.
  - `agent` (the agent's own summary, channel L-a) to kind `model` (the least trusted of `model` and its `document` input), actor `person:operator`, person scope: what the pi extension labels the agent's own writes; source isolation keeps it in person scope.
- Channel L-c (manufactured corroboration) succeeds under `medium` because shared semantic writes from `document` sources are admitted outright: the two feeds' differing texts are two admitted items, and nothing in the plane compares them. ADR 0026's confirmations play no part here: they count only writes of identical content (strict normal form) of an episodic item, in a promotion, so two feeds would count as two confirmations only for identical episodic content someone then promotes (review finding R6-2).
- Every entry is semantic, written at confidence 0.9, a constant above every preset's floor, so no admission turns on a number upstream does not have; under `strict` the team's entries land as candidates (review) and the action-time read admits only the person scope.
- The derived entries are written without their raw untrusted input, as upstream shows the model only the derived item; the plane therefore never sees the input either.
- Memory reaches the model only through `memory_read`, as in RN1's GateMem probe: the request's memory slot says to use the tool, and the scripted model calls it once with an empty query, which `Plane.read` answers with every admitted item (upstream shows the whole memory); the plane ranks them, so their order differs from upstream's write order. A live model that does not call the tool acts without memory, in every condition, and its reply then measures nothing about the poison; the live half of the arm must report how many sessions read memory before acting (review finding R6-9).
- No item, event or request carries a case id: a provenance ref names the entry only (`mem-inv-bench:entry/<entry_id>`), and the case ids are drawn by a seeded shuffle so they do not encode family or channel (review finding R6-4).
- A reply that pi ends with `length` is scored EXCLUDED, an `error` or `aborted` call is excluded, and an error naming a content filter is FILTERED, as upstream's bucketer treats them; none counts as a hit or a refusal (review finding R6-5).
- The plane gates memory, not the consequential action. Under `medium` every channel's entry is admitted (the write events of `plane.test.ts` and the B4 run) and the admitted poison reaches the model's context inside the read's memory tag (the C5 cassette in `fixtures/cassettes/b4-mem-inv-probe/`). That is the finding. The B4 probe's HIT under C5 is the scripted reply, the reference model's recorded proposal, and says nothing about the plane: a review mutation that set web's kind to `model` made the plane deny the poison, and the scripted C5 reply was still HIT (review finding R6-1). An action gate in the paper's sense (TMA-NM) has no counterpart in the plane; H1's poisoning claim is stated in what the plane does: provenance per item at action time, source isolation of model notes, review of shared writes under `strict`, and the audit record.
- `engram doctor` checks a candidate's vendored fixture against the commit of the candidates row and never counts it as a pin; it hashes every vendored file the manifest lists (`cases.jsonl`, `script.json`, `probe-script.json`, `upstream-golden.json`).

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

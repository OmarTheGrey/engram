# RV1 Live runs that survive transient errors and finish at H1's size

Status: done on branch rv1, awaiting review. Paths used: `packages/runner/src/journal.ts` (new), `packages/runner/src/model/cassette.ts`, `packages/runner/src/conditions.ts`, `packages/runner/src/gatemem-probe.ts`, `packages/runner/src/mem-inv-probe.ts`, `packages/runner/src/longmemeval-probe.ts`, `packages/runner/src/run.ts`, `packages/runner/src/judge.ts`, `packages/runner/src/lint-faults.ts`, `packages/runner/src/lint-fault-set.ts`, `packages/runner/src/live.ts`, `packages/runner/src/config.ts`, `packages/runner/src/research/h1-sessions.ts`, `packages/runner/scripts/run.ts`, `packages/runner/scripts/run-mem-inv.ts`, `packages/runner/scripts/h1-sessions.ts`, `packages/runner/test/rv1.test.ts` and `scale.test.ts` (new), `packages/runner/test/judge.test.ts`, `fixtures/cassettes/b4-mem-inv-probe/`, `fixtures/cassettes/x1-h1-mem-inv/`.

From the repository review of the experiment pipeline (findings RV-EXP-1 to RV-EXP-5 and RV-EXP-10, reviewed on main `c89bdf8`). Read AGENTS.md, `docs/conventions/testing.md` and `docs/architecture.md` before starting. Card RV2 takes the review's RV-EXP-6, -7 and -9 (`research/analysis/`, the readings kit, the MANIFEST) in parallel; this card does not touch them.

Goal: a live run of H1 or H2 survives a transient provider error, keeps every session it finished when it stops or crashes, resumes where it stopped, fits its results at H1's full size, records every judge call it paid for, and is bounded in turns per session and in spend per provider.

The findings this card answers:

- RV-EXP-1 (critical): one transient error in the answer model aborts the whole run, and results are written only at the end.
- RV-EXP-2 (critical): the GateMem results file at H1's size exceeds V8's string limit when built as one string, and `h1-sessions.ts` reads it as one.
- RV-EXP-3 (important): a judge attempt that fails with a non-transient error is not cached, so a replay misses and a live rerun pays again.
- RV-EXP-4 (important): H2's stopping rule names a per-provider spend ceiling in the experiment config, and none exists.
- RV-EXP-5 (important): nothing bounds a session's turns.
- RV-EXP-10 (minor): MEM-INV-Bench's item ids differ under C5 from C2 to C4, because the plane's event ids share the counter; C3 and C4 add sentences v1 does not describe.

Files: `packages/runner/src/` (the answer path in `model/cassette.ts` and `model/retry.ts`, the session in `conditions.ts`, the three probes, `run.ts`, `judge.ts`, `config.ts`, a run journal), `packages/runner/scripts/run.ts`, `packages/runner/scripts/h1-sessions.ts` (its reader only), `packages/runner/src/research/h1-sessions.ts` (the turn-limit exclusion only), `packages/runner/test/`, the MEM-INV-Bench cassettes the id fix changes (`fixtures/cassettes/b4-mem-inv-probe/`, `fixtures/cassettes/x1-h1-mem-inv/`), Makefile, AGENTS.md and CLAUDE.md for a new command.

Depends on: RN1, B3, B4, B5, B6, X1, L3, L4 (all merged).

Acceptance: `make test` and `make test-scale` pass; each finding's test passes (the transient 429 run gives one row and two new calls; a crashed run resumes with zero new calls for the sessions it kept; 26,616 rows at H1's full-set mean sizes are written and read back; a judge attempt that failed with a 400 replays with zero calls; a faux model with a set cost per call stops at the ceiling and keeps its rows; a capped session is excluded under its own reason); every fixture config replays with zero new calls.

Out of scope: setting the turn limit's value, the exclusion rule and the spend ceiling's value (the lead's, before the tag; this card builds the mechanisms with proposed defaults); editing `docs/research/preregistration.md`; RV-EXP-6, -7, -8 and -9; a schema change.

## Proposed v1 wording (RV-EXP-10, for the lead)

v1 is the lead's text and is not edited here (`docs/log/2026-11-19-rv1-finding-v1-condition-wording.md`). Proposed replacements for the C3 and C4 lines of the pre-registration's Conditions section, worded as the code is (`policyInstruction` and `metadataInstruction` in `packages/runner/src/conditions.ts`):

- **C3** (`policyText: true`): C2 plus, in the system prompt, the policy C5 enforces: a sentence naming its preset ("Follow this memory policy (preset <preset>) whenever you read or write memory."), a sentence naming the requester's id, level and memberships, one instruction ("Use only memory the policy lets the requester read, and write only what it lets them write."), one fixed legend line, and the policy as JSON with sorted keys (ADR 0015, PR 6 amendment).
- **C4** (`metadataInstruction`, added after C3's text): a sentence saying each item a read returns carries metadata as attributes of its tag besides its id, scope and rank, the benchmark's legend, and one instruction ("Decide from this metadata, under the policy above, which memory you use and what you reveal."); the rest of C4's line stands.
- **Ids** (one sentence under C5): "On MEM-INV-Bench the case's entries carry the same item ids in every condition; under C5 the plane's events, and an item the model writes through the plane, take ids from a separate counter."

# ADR 0031: What C1 and C4 are on GateMem and on MEM-INV-Bench

Status: proposed, 2026-11-02
Deciders: drafted by the orchestrating session's plan (docs/tasks/prereg-v1-plan.md); for the lead's acceptance
Supersedes: nothing; it settles plan decision 4 of `docs/tasks/prereg-v1-plan.md` for card X1.

## Context

H1's primary test is C4 minus C5 ("the stronger instruction condition"), and H2 and H5 name C1, but the runner built only C2, C3 and C5 (`packages/runner/src/config.ts` before card X1). The pre-registration's Conditions table defines C1 as "no memory: none; long context only; governance none" and C4 as "instruction with metadata: the store directly, retrieval carries requester and policy metadata (GateMem's RAG-Policy); the model decides from the metadata". Plan decision 4 says C4 and C1 are ported, not invented: on GateMem, C4 is its RAG-Policy agent and C1 its long-context agent at the pin `a983828`; on MEM-INV-Bench, C4 gives each retrieved memory its source channel and provenance kind, with the policy as text, and the model decides, and C1 is not built.

Reading upstream at the pin (`bench/agents/rag_policy.py`, `base.py`, `long_context.py`) settled two facts the plan did not have:

- GateMem's RAG-Policy agent is not "the model decides from the metadata". It computes metadata per turn chunk (the speaker and role, the principals and resources the text mentions by regular expressions over names, and topic tags from keyword lists) and runs a hand-written gate over it (a table per role and relationship type, per domain), then drops every chunk the gate refuses before TF-IDF or embedding retrieval. The model sees only the surviving chunks, as `Memory i (speaker=<id>): [<role>:<id>] <text>`, in the same prompt every GateMem agent uses. Ported as it is, C4 would be a second deterministic filter before the model call: what the table calls enforcement (C5), not instruction.
- The gate reads no hidden field. Its real-model path reads the episode's principals and relationships, each turn's speaker and text, and the checkpoint's asker, query text and as-of turn; `query_type` and `expected_action` reach only upstream's offline stub and a log line. `packages/bench/scripts/upstream-rag-policy-golden.py` reruns upstream's gate with every hidden checkpoint field changed: nothing moved on any of the 2,218 checkpoints.

## Decision

1. **One condition table.** `CONDITION_TABLE` in `packages/runner/src/config.ts` states each condition's mechanism in three columns, the only place the runner reads it from: where memory comes from (`context` for C1, `store` for C2 to C4, `plane` for C5), whether the policy is text in the system prompt (C3, C4), and whether each read item carries metadata (C4). Neighbours differ in one column each (C1 and C2 in memory, C2 and C3 in policy text, C3 and C4 in metadata), and C5 is C2's prompt on the plane, as before (ADR 0015, decision D13).
2. **C1 on GateMem is its long-context agent.** No store and no memory tool; GateMem's query prompt with the long-context agent's memory block, the last 300 turns up to the checkpoint (`run_eval.py`: `max(300, top_k)`), built by card B1's port (`longContextItems` in `packages/bench/src/gatemem/agents.ts`, held to upstream's prompts by `upstream.test.ts`). Its cache key and row name the store `none` and the preset `none`, and it runs once per item and seed whatever the store list. C1 is not built on MEM-INV-Bench; a config there refuses it.
3. **C4 on GateMem is C3 plus the RAG-Policy's metadata and verdict, shown, not enforced.** `packages/bench/src/gatemem/rag-policy.ts` ports the agent's chunk metadata and gate (turn chunks, the path the released data takes; no records, no record refs). Every item a C4 read returns carries `speaker`, `speaker_role` and `access` (`allowed` or `denied`, the gate's verdict for the asker) as attributes of its memory tag, and the system prompt carries C3's policy text and a constant legend of the attributes. The model decides. The port is held to upstream's own output on the 20 fixture checkpoints (`upstream-rag-policy-golden.json`, `rag-policy.test.ts`) and, by a development-time check, on all 2,218 at the pin with 0 mismatches.
4. **C4 on MEM-INV-Bench** is C3 plus each item's `channel` (the path the harness wrote it through) and `provenance` (the kind Engram records, ADR 0029's mapping), with a constant legend; the model decides.
5. **Retrieval is the same in C2 to C5.** C4 reads through the same `memory_read` tool over the store as C2 and C3; upstream's TF-IDF or embedding top-k is not ported, so retrieval is not a difference between conditions (conditions.ts). A read with no query terms returns every item in every condition (the plane's rule), since Mem0's search returns nothing for an empty query.
6. **The metadata is presentation of facts, never a decision.** Attributes are rendered by the memory tag's one renderer (`tagUngovernedRead`, ADR 0015's PR 6 amendment) after the rank, escaped, with names that cannot reuse the tag's own; without them the tag is C2's and C3's byte for byte.

## Alternatives considered

- **C4 as upstream's filter** (drop what the gate refuses, then retrieve): faithful to upstream's behaviour and to the paper's RAG-Policy numbers, but a deterministic filter before the model is C5's mechanism, so C4 minus C5 would compare two enforcers and H1 would no longer test enforcement against instruction. Cost if the lead prefers it: C4's tool filters on `access` instead of showing it, one branch in `ungovernedMemoryTools`, and the H1 statement and the C4 row are reworded in v1.
- **C4 with the RAG-Policy's metadata but no verdict** (speaker, role, mentions, topic tags only): closer to "the model decides", but C3's tag already shows the speaker's scope, so C4 would differ from C3 by little, and the ported gate, the RAG-Policy's policy content, would be unused. Cost if chosen: drop the `access` attribute and its legend line.
- **C4 with Engram's own facts** (each item's owner, provenance kind and grants): the cleanest contrast with C5, since the model would decide from exactly what the plane enforces, but it is not GateMem's RAG-Policy, which plan decision 4 and the Conditions table name. It may be worth a separate exploratory condition.
- **C1 through a memory tool that returns the long context:** keeps the tools C2 to C5 declare, but C1 is "no memory", and GateMem's long-context agent has no tool.

## Consequences

- H1 can run C2, C3, C4 and C5 on both arms (`research/configs/h1-gatemem.json`, `research/configs/h1-mem-inv.json`); H2 and H5 have C1 on GateMem. Card X1's acceptance holds for every condition on both arms (`research/configs/x1-h1-probe.json`).
- C4 on GateMem is a strong instruction condition: the model is told, item by item, what a hand-tuned policy written by the benchmark's authors allows (39 percent of the 325,530 turn chunks at the pin, by the development-time check). The pre-registration's v1 should state that C4 on GateMem is "C3 plus GateMem's RAG-Policy verdicts as metadata" and that upstream's RAG-Policy numbers are not C4's.
- Under C4 every retrieved item reaches the model's context, as under C2 and C3, so GateMem's context-leak measure cannot tell C4 from C3; the answer-level measures (A and F through the judge) can.
- The legend texts are part of the protocol: changing either changes every C4 cache key, so they are fixed with the pre-registration's tag.
- Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/tasks/prereg-v1-plan.md`, decision 4 and PR 3
- `docs/research/preregistration.md`, the Conditions table and H1
- GateMem `bench/agents/rag_policy.py`, `base.py`, `long_context.py`, `bench/retrieval/chunker.py`, `bench/scripts/run_eval.py` at `a983828b3bb7565e16e25ac8cdc2fc1982633b0b`
- ADR 0015 (decision D13, the memory tag), ADR 0017, ADR 0029, ADR 0030
- `packages/bench/scripts/upstream-rag-policy-golden.py`, `packages/bench/scripts/check-rag-policy-upstream.ts`

# ADR 0031: What C1 and C4 are on GateMem and on MEM-INV-Bench

Status: proposed, 2026-11-02 (rewritten in the review fix pass of PR #25, 2026-11-02)
Deciders: drafted by the orchestrating session's plan (docs/tasks/prereg-v1-plan.md); for the lead's acceptance
Supersedes: nothing; it settles plan decision 4 of `docs/tasks/prereg-v1-plan.md` for card X1.

## Context

H1's primary test is C4 minus C5 ("the stronger instruction condition"), and H2 and H5 name C1, but the runner built only C2, C3 and C5 before card X1. The pre-registration's Conditions table defines C1 as "no memory: none; long context only; governance none" and C4 as "instruction with metadata: the store directly, retrieval carries requester and policy metadata (GateMem's RAG-Policy); the model decides from the metadata". Plan decision 4 ports both from GateMem at the pin `a983828`; on MEM-INV-Bench, C4 gives each retrieved memory its source channel and provenance kind with the policy as text, and C1 is not built.

Three facts settled what the plan could not:

- GateMem's RAG-Policy agent (`bench/agents/rag_policy.py`) is a deterministic filter before the model: a hand-written table per role and relationship type drops every turn chunk it refuses, then the rest is retrieved and shown. It reads no hidden field (rerun with every hidden checkpoint field changed, nothing moved on any of the 2,218 checkpoints at the pin).
- Its policy is not the one C5 enforces. Over the 325,530 turn items up to the 2,218 checkpoints, for each asker, the RAG-Policy gate and the plane's read decision under `medium` agree on 235,384 (72.3 percent); the gate allows where the plane denies on 60,305 (18.5 percent), and denies where the plane allows on 29,841 (9.2 percent) (`node packages/runner/scripts/compare-c4-verdicts.ts .engram/upstream/gatemem/bench/data`). On the turns holding an access-control checkpoint's leak targets, the gate allows 1,528 of 5,259 and the plane 722. A C4 that showed the gate's verdict would measure a policy difference as well as a mechanism.
- Upstream's MEM-INV-Bench writes the agent's own note (laundering channel `summarize`) with the model under test (`exp1_propensity.py` `build_memory`, `driver.gen`, temperature 0.3, 300 tokens, the raw poison when the reply is empty or cut off).

## Decision

1. **One condition table.** `CONDITION_TABLE` in `packages/runner/src/config.ts` states each condition's mechanism in three columns: where memory comes from (`context` for C1, `store` for C2 to C4, `plane` for C5), whether the policy is text in the system prompt (C3, C4), and whether each read item carries metadata (C4). Neighbours differ in one column each.
2. **One retrieval rule and one ordering rule for C2 to C5** (ADR 0009, amended the same day). Every condition retrieves through the store's own search; the plane, which may not search outside the reader's member scopes (ADR 0009, D5 and N1), matches items it reaches only through a grant by the lexical stores' rule (every query term). Every condition orders what it shows by core's `rankForRead`, each item scored on its own. On a lexical store C5's entries are a subset of C2's, in C2's relative order (`packages/runner/test/retrieval.test.ts`).
3. **C1 on GateMem is its long-context agent.** No store and no memory tool; GateMem's query prompt with the long-context agent's memory block (the last 300 turns), built by card B1's port. Its cache key and row name the store and the preset `none`, and it runs once per item and seed. C1 is not built on MEM-INV-Bench.
4. **C4 on GateMem is C3 plus, per item, its speaker, the speaker's role and a verdict for the asker, `access="allowed"` or `"denied"`, shown and not enforced; the model decides.** The verdict is a decision shown to the model. Its source is a config field, `c4_verdicts`:
   - `engram` (the default, and H1's): the plane's own read decision under the policy and preset C5 enforces, computed by core (`evaluateRead`) for the asker at the checkpoint's time. An item is `allowed` exactly when C5's read would return it, so C4 and C5 apply one policy and differ in mechanism only, which is what H1 tests.
   - `gatemem-rag`: GateMem's RAG-Policy gate (`packages/bench/src/gatemem/rag-policy.ts`, held to upstream on the 20 fixture checkpoints and, when the pinned data is present, on all 2,218). Kept so the lead can choose it; the fixture suite records both.
5. **C4's legend is neutral.** It names no benchmark and says a verdict depends on who is asking; a test checks that no condition's request on either arm contains "GateMem", "MEM-INV", "benchmark" or "baseline".
6. **C4 on MEM-INV-Bench** is C3 plus each item's `channel` and `provenance` kind. It carries no verdict: on this arm the plane's decision is the write gate's as well as the read filter's, and under H1's preset every entry is admitted, so a verdict would read `allowed` for every item.
7. **The agent's own note is the model under test's**, written before the sessions with upstream's prompt, temperature 0.3, 300 tokens and fallback, once per case and model (upstream writes one per scenario and model for every trial), seeded with the config's first seed and cached like every call. The vendored case keeps the reference model's recorded note for runs without a model and the text it summarises (`summarized_from`).

## Alternatives considered

- **C4 with the RAG-Policy verdict by default** (the first draft): the benchmark's own policy content, but 27.7 percent of the verdicts differ from C5's policy, so C4 minus C5 would mix policy and mechanism. Kept as `gatemem-rag`.
- **C4 as upstream's filter**: deterministic governance before the model is C5's mechanism; C4 minus C5 would compare two enforcers.
- **C4 with metadata and no verdict**: C3's tag already shows the speaker's scope, so C4 would differ from C3 by little.
- **The store's search for grant-reached items in C5**: forbidden by ADR 0009 (D5, N1): a capped search over a scope the reader is not a member of lets hidden items crowd a granted one out.
- **The reference model's recorded note for every model**: fixed world state, but not upstream's protocol, and the legend's "a note you wrote yourself" would be false.

## Consequences

- H1 runs C2 to C5 on both arms (`research/configs/h1-gatemem.json` with `c4_verdicts: "engram"`, `research/configs/h1-mem-inv.json`); H2 and H5 have C1 on GateMem; card X1's acceptance covers every condition and both verdict sources (`research/configs/x1-h1-probe.json`).
- C4 with the engram verdict is a strong instruction condition: the model is told, item by item, what the enforcer would decide. H1 then asks whether being told is as good as being enforced.
- Under C4 every retrieved item reaches the model's context, as under C2 and C3, so context-leak measures cannot tell C4 from C3; GateMem's judge scores the answers (the runner's judge pass).
- On a store whose search caps its hits (Mem0's top 20), C5's search over the reader's fewer scopes can return what the capped search over every scope dropped, so the subset property holds on lexical stores only; H1 runs on the fake store.
- The legends, the verdict source and the note's sampling are protocol: changing one changes C4's or the notes' cache keys.
- What the lead decides: the default verdict source (`engram` recommended), whether MEM-INV-Bench's C4 should carry a verdict, and whether the note seed should be per seed rather than the first.
- Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/tasks/prereg-v1-plan.md`, decision 4 and PR 3; the review of PR #25 (findings P3-1 to P3-13, J1, J2)
- `docs/research/preregistration.md`, the Conditions table and H1
- GateMem `bench/agents/rag_policy.py`, `base.py`, `long_context.py`, `bench/retrieval/chunker.py` at `a983828b3bb7565e16e25ac8cdc2fc1982633b0b`; MEM-INV-Bench `code/exp1_propensity.py` at `cf3c9a4ca9f0478000d6aa26eb268b875232d34b`
- ADR 0009, ADR 0015 (decision D13, the memory tag), ADR 0017, ADR 0029, ADR 0030

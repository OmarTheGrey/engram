# Design

Consolidated from docs/log by research/scripts/consolidate_log.py. Edit the entries, not this file.

## Govern

**2026-10-22, S0.13, decision.** ADR 0004 (Provenance model and source trust) was accepted with the amendments listed in the ADR. What forced it: Eywa's evidence, signal, belief layers. Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0004-provenance-and-source-trust.md` holds the decision with status accepted with amendments, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^1]

**2026-10-22, S0.13, decision.** ADR 0005 (Validity is bi-temporal; updates supersede, never overwrite) was accepted with the amendments listed in the ADR. What forced it: Zep's event time versus ingestion time and edge invalidation. Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0005-bi-temporal-validity.md` holds the decision with status accepted with amendments, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^2]

**2026-10-22, S0.13, decision.** ADR 0007 (Write gate rules and source isolation) was accepted as recommended. What forced it: MPBench (aggressive write policies are easier to poison. Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0007-write-gate-and-source-isolation.md` holds the decision with status accepted, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^3]

**2026-10-22, S0.13, decision.** ADR 0008 (Lints: deterministic first, model-based second, both as events) was accepted as recommended. What forced it: HaluMem (evaluate per operation, not end to end). Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0008-two-tier-lints.md` holds the decision with status accepted, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^4]

## Twin

**2026-10-22, S0.13, decision.** ADR 0021 (Twin: person and role scopes, consent grants, handover; offboarding deferred) was accepted as recommended. What forced it: GateMem's shared-pool leaks. Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0021-twin-scopes-and-grants.md` holds the decision with status accepted, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^5]

## Distill

**2026-10-22, S0.13, decision.** ADR 0011 (One lifecycle for every class; replay admission for procedures) was accepted with the amendments listed in the ADR. What forced it: SKILL.nb (provisional, released, retired. Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0011-one-lifecycle-replay-admission.md` holds the decision with status accepted with amendments, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^6]

**2026-10-22, S0.13, decision.** ADR 0012 (Induction method: Agent Workflow Memory over pi session trees, reimplemented in TypeScript) was accepted as recommended. What forced it: AWM (ICML 2025) is the simplest published method with strong results and a Python reference implementation. Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0012-induction-awm-over-pi-sessions.md` holds the decision with status accepted, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^7]

## Plane

**2026-10-22, milestone.** The architecture (`docs/architecture.md`, as decided on 2026-10-22) and the roadmap (`docs/roadmap.md`, prepared 2 October 2026) were added to the repository, and AGENTS.md now points to both. Step-0 tasks S0.7 to S0.13 implement the architecture's memory model and interfaces, and S0.13 expands the roadmap's task cards into `docs/tasks/`; until now both were referenced but missing. Two living documents. The roadmap still describes the Python-first v1 layout for cards E0.1, E0.3, E8.1 and E8.3, which ADR 0001 supersedes; S0.13 rewrites those cards. Schema v0 (S0.7) follows the architecture's MemoryItem, MemoryEvent and Policy fields; the hypotheses in the pre-registration (S0.12) follow the roadmap's gates and experiment cards.[^8][^9][^10]

**2026-10-22, S0.9, decision, H1, supersedes 2026-10-22-s0-9-invariants-red.** The lead-owned invariants file changed after the final step-0 review (an Opus reviewer, the second reviewer the testing convention requires): it runs in `make test`, invariants 1 and 2 are expected failures that must fail with their own counterexample, the Plane is asynchronous with the stub writing through the fake adapter, and invariants 2 and 4 check the store as well as the projection. Excluded from `make test` and run with continue-on-error, the file had no gate, and running it alone reported a false green. 51 core tests pass; `make test-invariants` still fails invariants 1 and 2 with a counterexample and a seed. The red properties now wait on E2.2 and E2.3, not E2.1. Issue #1 is retargeted; the lead confirms this change.[^11][^12][^13]

**2026-10-22, S0.13, decision, H4.** This entry records the decision of ADR 0001: the control plane is built on pi, with the plane in TypeScript inside the pi process and research in Python. The lead accepted it on 2026-10-17. The documentation convention pairs every architectural decision with a `decision` entry, and the 2026-10-17 milestone entry recorded the body of knowledge rather than this decision. ADR 0001 now has its decision entry; S0.1 to S0.5 already build on it (pi 1.3.0 pinned, interception proven in an SDK session). Cards E0.1, E0.3, E8.1 and E8.3 are rewritten and PX1 to PX3 and RN1 to RN2 are added under `docs/tasks/`.[^14]

**2026-10-22, S0.13, decision.** ADR 0002 (Memory item schema, versioning and generated contracts) was accepted with the amendments listed in the ADR. What forced it: CoALA's three classes (episodic, semantic, procedural). Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0002-schema-and-generated-contracts.md` holds the decision with status accepted with amendments, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^15]

**2026-10-22, S0.13, decision.** ADR 0003 (Event log as source of truth; store state as projection; SQLite via node:sqlite) was accepted with the amendments listed in the ADR. What forced it: Eywa keeps SQLite authoritative and treats vector and graph as rebuildable projections. Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0003-event-log-and-sqlite.md` holds the decision with status accepted with amendments, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^16]

**2026-10-22, S0.13, decision.** ADR 0006 (Scope, owner and grants; policy as typed objects, not a policy language) was accepted with the amendments listed in the ADR. What forced it: GateMem's principals writing into one pool and its leak-target annotation. Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0006-scope-owner-grants-typed-policy.md` holds the decision with status accepted with amendments, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^17]

**2026-10-22, S0.13, decision.** ADR 0009 (Retrieval explanations carry score components, rank and policy decision) was accepted with the amendments listed in the ADR. What forced it: Generative Agents' scored retrieval (recency, importance, relevance). Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0009-retrieval-explanations.md` holds the decision with status accepted with amendments, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^18]

**2026-10-22, S0.13, decision.** ADR 0010 (Retention never deletes; eviction retires; long-horizon arm is mandatory) was accepted as recommended. What forced it: Ground Truth First's tenure crossover (budgeted memories win at three weeks and lose at nine because eviction removed old material). Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0010-retention-retires.md` holds the decision with status accepted, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^19]

**2026-10-22, S0.13, decision.** ADR 0013 (Adapter contract with capability flags; conformance suite on a fake first) was accepted with the amendments listed in the ADR. What forced it: The stores differ in what they do natively: Mem0 (extract and update with ADD, UPDATE, DELETE, NOOP. Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0013-adapter-contract-and-conformance.md` holds the decision with status accepted with amendments, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^20]

**2026-10-22, S0.13, decision.** ADR 0014 (No-bypass: store commands blocked in bash; MCP store tools wrapped) was accepted with the amendments listed in the ADR. What forced it: Invariant 2 is meaningless if an agent can write to the store from a shell. Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0014-no-bypass.md` holds the decision with status accepted with amendments, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^21]

**2026-10-22, S0.13, decision.** ADR 0017 (Every model call is cached, metered and seeded; cassettes are the cache) was accepted with the amendments listed in the ADR. What forced it: MERIT's full metering. Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0017-cached-metered-seeded-model-calls.md` holds the decision with status accepted with amendments, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^22]

**2026-10-22, S0.13, decision.** ADR 0018 (Duplicate and near-duplicate detection without embeddings by default) was accepted as recommended. What forced it: The duplicate lint must be deterministic to count in H3's deterministic tier. Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0018-duplicates-without-embeddings.md` holds the decision with status accepted, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^23]

**2026-10-22, S0.13, decision.** ADR 0019 (Monorepo tooling) was accepted with the amendments listed in the ADR. What forced it: See the proposal in docs/decisions/README.md. Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0019-monorepo-tooling.md` holds the decision with status accepted with amendments, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^24]

**2026-10-22, S0.13, decision.** ADR 0022 (Other harnesses through MCP; interception limits stated) was accepted with the amendments listed in the ADR. What forced it: ADR 0001. Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0022-other-harnesses-through-mcp.md` holds the decision with status accepted with amendments, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^25]

## Research

**2026-10-22, S0.13, decision.** ADR 0015 (Evaluation protocol: six benchmarks, seven conditions, vendored judges, label audit) was accepted with the amendments listed in the ADR. What forced it: GateMem, MPBench, LongMemEval, MERIT, MemoryAgentBench and tau2-bench cover governance, poisoning, recall, action, competencies and tool use. Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0015-evaluation-protocol.md` holds the decision with status accepted with amendments, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^26]

**2026-10-22, S0.13, decision.** ADR 0016 (Statistics: paired bootstrap, Holm, three models from three providers, stopping rules) was accepted with the amendments listed in the ADR. What forced it: Kapoor (joint accuracy and cost, holdouts). Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0016-statistics.md` holds the decision with status accepted with amendments, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^27]

**2026-10-22, S0.13, decision.** ADR 0023 (Pre-registration lives in the repo, tagged, and is mirrored externally) was accepted with the amendments listed in the ADR. What forced it: Nosek. Drafted by the coding agent from the proposal, step-0 results and the literature review; the lead has not yet reviewed it. `docs/decisions/0023-preregistration-in-repo.md` holds the decision with status accepted with amendments, pending lead review; the index in `docs/decisions/README.md` is updated. The cards it unblocks can start. The lead accepts, amends or reverses it; until then the code follows it as a recommendation.[^28]

[^1]: `docs/decisions/0004-provenance-and-source-trust.md`
[^2]: `docs/decisions/0005-bi-temporal-validity.md`
[^3]: `docs/decisions/0007-write-gate-and-source-isolation.md`
[^4]: `docs/decisions/0008-two-tier-lints.md`
[^5]: `docs/decisions/0021-twin-scopes-and-grants.md`
[^6]: `docs/decisions/0011-one-lifecycle-replay-admission.md`
[^7]: `docs/decisions/0012-induction-awm-over-pi-sessions.md`
[^8]: `docs/architecture.md`
[^9]: `docs/roadmap.md`
[^10]: `AGENTS.md`
[^11]: `packages/core/test/property/invariants.test.ts`
[^12]: `packages/core/src/plane.ts`
[^13]: `make test-invariants`
[^14]: `docs/decisions/0001-pi-as-base.md`
[^15]: `docs/decisions/0002-schema-and-generated-contracts.md`
[^16]: `docs/decisions/0003-event-log-and-sqlite.md`
[^17]: `docs/decisions/0006-scope-owner-grants-typed-policy.md`
[^18]: `docs/decisions/0009-retrieval-explanations.md`
[^19]: `docs/decisions/0010-retention-retires.md`
[^20]: `docs/decisions/0013-adapter-contract-and-conformance.md`
[^21]: `docs/decisions/0014-no-bypass.md`
[^22]: `docs/decisions/0017-cached-metered-seeded-model-calls.md`
[^23]: `docs/decisions/0018-duplicates-without-embeddings.md`
[^24]: `docs/decisions/0019-monorepo-tooling.md`
[^25]: `docs/decisions/0022-other-harnesses-through-mcp.md`
[^26]: `docs/decisions/0015-evaluation-protocol.md`
[^27]: `docs/decisions/0016-statistics.md`
[^28]: `docs/decisions/0023-preregistration-in-repo.md`

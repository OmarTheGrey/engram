# 18c Multi-agent sharing: agent principals, delegation, cross-agent faults

## Executive summary

Engram does not need agent-level principals, delegation or cross-agent conflict resolution as new schema before Gate D. They are already expressible: `Principal` is an opaque string (`agent:pi`), `Grant.to` accepts an agent pattern (`agent:claude-code/*`), and `Actor` (`packages/core/src/actor.ts`, not in `schema.ts`) carries `id`, `memberships` and a harness-set `source`. An agent acting for a person is an actor whose `memberships` are a subset of the person's, built at the harness boundary, so delegation is attenuation by construction and needs no field. ADR 0034 already refuses grant changes by a model-sourced actor, which is the "an agent cannot widen its own authority" half. What is missing is a stated rule, a test that proves it, and fault scenarios that show the failure classes the 2026 literature names: confused deputy, subagent memory inheritance, cross-agent poisoning and lost updates. All of those can be tested with scripted actors on the existing plane and the existing MEM-INV-Bench harness (ADR 0029), with no schema change. The one thing that does need a schema change is recording on whose behalf an agent wrote (`delegated_by`). That is a Wave 2 schema PR and only worth doing if the tests show the log cannot reconstruct it. Competitors confirm the gap Engram fills: Letta, Mem0 and CrewAI scope by id or tree and leave the policy to the caller.

## Landscape (stars and dates from `gh api` on 2026-11-21 unless noted)

| Name | URL | Licence | Stars, last push | Lang | What it gives us | Mode |
|---|---|---|---|---|---|---|
| A2A protocol | github.com/a2aproject/A2A | Apache-2.0 | 26,618, 2026-11-20 | spec (Shell) | Agent cards, signed cards in 1.0 (from LF press release and guide, normative text not read); verified agent identity | ideas only, identity source for MP-46 |
| MCP spec | github.com/modelcontextprotocol/modelcontextprotocol | NOASSERTION per API | 9,737, 2026-11-21 | TypeScript | Multi-client sessions and authorization; licence not verified | ideas only (covered by MP-46, MP-47) |
| Letta | github.com/letta-ai/letta | Apache-2.0 | 25,506, 2026-10-18 | Python | Shared blocks: one `block_id` attached to many agents; read-only is per block, not per agent; docs warn of lost updates on full rewrites (docs.letta.com shared memory) | ideas, plus conformance probe |
| Mem0 | github.com/mem0ai/mem0 | Apache-2.0 | 69,296, 2026-11-18 | Python | `user_id`, `agent_id`, `app_id`, `run_id` scoping; its own docs disagree on whether a `user_id` filter excludes rows with an `agent_id` | ideas, adapter probe |
| Zep and Graphiti | github.com/getzep/graphiti | Apache-2.0 | 32,972, 2026-11-20 | Python | Per-user graphs; already covered (note 2501.13956) | ideas only |
| CrewAI | github.com/crewAIInc/crewAI | MIT | 61,138, 2026-11-21 | Python | Hierarchical memory scope tree; crew-wide sharing by default, per-agent path to restrict (docs.crewai.com) | ideas only |
| AutoGen | github.com/microsoft/autogen | CC-BY-4.0 per API | 61,955, 2026-11-12 | Python | Shared conversation state; licence reads as CC-BY-4.0, which is not a software licence, so treat as not absorbable | ideas only |
| LangGraph | github.com/langchain-ai/langgraph | MIT | 45,222, 2026-11-20 | Python | Shared store with namespaces; MP-59 covers adapters | none new |
| OpenAI Agents SDK | github.com/openai/openai-agents-python | MIT | 30,794, 2026-11-21 | Python | Handoffs between agents (not read in depth) | ideas only |
| Governed Shared Memory (MemClaw, ArgusFleet) | arXiv 2606.24535 | harness only, service closed | n/a | Python | Trust ladder, get-by-id bypass, dedup before contradiction (note exists) | already in litreview |
| When Child Inherits | arXiv 2605.08460 | n/a | n/a | n/a | Four spawn failure classes, memory inheritance (abstract read) | new note, fault class |
| DelegateGuard | arXiv 2610.16005 | n/a | n/a | n/a | Attenuable capabilities, revocation propagation, 517,401 Enron emails (abstract read) | new note, invariant shape |
| Bounded Agents 2608.15888, Five-Plane 2606.12320, SEAgent 2601.11893 | arxiv.org | n/a | n/a | n/a | Confused deputy, macaroon-style capabilities, ABAC; seen only as search snippets, not read | not noted |

Not verified: whether Letta or Mem0 expose per-agent read control in a way the adapters could rely on (the docs read suggests not). The adapters do not need to, because the plane filters first (rule 2).

## Answers to the research question

1. **Agent-level principals.** Already there. `agent:<name>` is a valid principal; the read filter and grants treat it like any other. The missing piece is verified identity (MP-46 plus an A2A signed card or an MCP token), not schema.
2. **Delegation.** Express it as `memberships(agent) subset of memberships(person)`, built where the harness builds the actor (`packages/cli/src/setup.ts` `buildActor`, the MCP `--as --member` flags). Add an invariant that no event shows an agent actor reading an item the delegating person's actor could not, and that a revoked grant or offboarding cuts the agent's read at the next call. No schema change.
3. **Cross-agent conflict resolution.** Supersession lineage (ADR 0005) and the contradiction lint (ADR 0008) already resolve it. What is untested is two agents writing the same subject concurrently and the lint ordering finding from MemClaw (dedup swallowing a contradiction). Letta's own docs warn about lost updates, so a test is warranted.
4. **Could be a fault class or benchmark before Gate D:** confused deputy (a low-trust agent induces a high-trust agent to promote or write), cross-agent poisoning (agent A writes, agent B reads as its own), subagent inheritance, stale post-spawn grants, get-by-id and search bypass. All run as scripted-actor tests, or as new cases in the B4 MEM-INV-Bench harness whose channels already map to distinct `agent:*` actors. A new arm needs a preregistration amendment first (AGENTS.md, "What not to do"), so it rides MP-09.

## PR plans

**AB-GAP3-1 ADR: agents and delegation without schema**
- Goal: record the decision that agent principals are `agent:<name>` strings, that delegation is membership attenuation at the harness boundary, that grants by an agent are refused (ADR 0034), and that `delegated_by` is deferred. Include the A2A and MCP identity mapping rule (claims never widen grants).
- Absorbs: ideas from A2A, DelegateGuard, 2605.08460. Files: `docs/decisions/0037-agents-and-delegation.md`, `docs/log/`. Effort S. Depends on: none. Value: closes the question the thesis defence will ask; thesis section on scope of the claim. Risks: none; lead must accept the ADR. Acceptance: `make lint-docs`.

**AB-GAP3-2 Delegation and inheritance invariant**
- Goal: property test drawing a person, an agent acting for them (subset memberships) and a child of that agent; asserts reads are a subset, an agent-sourced grant change is refused, and a grant removal or offboarding cuts the agent and child at the next call (stale post-spawn state).
- Absorbs: DelegateGuard invariant shape, 2605.08460 classes. Files: `packages/core/test/property/invariants.test.ts` (or a sibling file the invariants runner picks up), `docs/log/`. Effort M. Depends on: none. Value: thesis (an eighth invariant with counterexample and seed), product (the answer to "can my agent read more than I can"). Risks: if the test finds a hole, it is a core finding and its fix is its own card. Acceptance: `make test-invariants`.

**AB-GAP3-3 Cross-agent fault scenarios**
- Goal: a scripted workload and fixtures for confused deputy and cross-agent poisoning: agent A (source `model`, untrusted) writes team memory, agent B (trusted tool actor) corroborates or promotes it, user agent reads. Expect the gate or promotion rule to hold, or record the leak as a finding. Include get-by-id and search paths (MemClaw finding). Add the case family to the preregistration proposals so the arm can be registered later.
- Absorbs: MemClaw tests, MEM-INV-Bench channels (ADR 0029, `CHANNEL_WRITERS`). Files: `fixtures/workloads/`, `packages/bench/src/mem-inv-bench/` (cases only), `docs/research/preregistration.md` proposal section, `docs/log/`. Effort M. Depends on: MP-09. Value: H1 second arm gains a multi-agent stratum. Risks: Engram's six provenance kinds have no "untrusted external", already noted in ADR 0029; cases may only confirm the known channel L-c gap. Acceptance: `make bench BENCH=mem-inv-bench` on the new subset, offline, plus `engram simulate --workload` run.

**AB-GAP3-4 Shared-store probes and concurrent-agent conflicts**
- Goal: conformance tests that run two agent actors on one scope against the fake adapters: concurrent writes on one subject (lineage and contradiction lint fire, none lost), duplicate gate runs after the contradiction lint, and the plane never relies on a store's own `agent_id` or shared-block permission (adapter returns more than the actor may read, the plane filters).
- Absorbs: Letta shared-block and Mem0 `agent_id` behaviour as the cases to test. Files: `packages/adapters/test/conformance/`, `packages/core/test/unit/plane/`. Effort M. Depends on: none. Value: H4 (store independence) and rule 2. Risks: Mem0 filter semantics are documented inconsistently, so the probe should assert the plane's output, not the store's. Acceptance: `make test`.

**AB-GAP3-5 Delegated actor builder (Wave 2, two PRs)**
- Goal: A, schema alone: optional `delegated_by` on `Provenance` or the event (rule 5, bump, migration, `make api`), only if AB-GAP3-2 or 3 show the log cannot reconstruct who an agent acted for. B: `engram mcp --acting-for person:x` and the pi extension build an actor whose memberships are the intersection, recording `delegated_by`; token subject comes from MP-46.
- Absorbs: DelegateGuard (idea), A2A signed cards (identity). Files: `packages/core/src/schema.ts` (A); `packages/mcp`, `packages/cli/src/setup.ts`, `packages/pi-extension` (B). Effort L. Depends on: MP-46, AB-GAP3-2. Value: product (audit shows on whose behalf). Risks: a schema change is a Part I surface; no hypothesis needs it. Acceptance: `make test-invariants` plus `make api-check`.

## Recommended order

1. AB-GAP3-1 (cheap, settles the framing, Wave 0 safe).
2. AB-GAP3-2 (the invariant is the thesis-grade evidence that delegation needs no schema).
3. AB-GAP3-3 (turns the literature's failure classes into a registered arm).

Notes written: `docs/readings/litreview/2605.08460-subagent-spawn-inheritance.md`, `2610.16005-delegateguard.md`, `repo-a2a-protocol.md`.

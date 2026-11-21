# 18b Read-side information-flow control (gap-filling, prefix AB-GAP2)

## Executive summary

Engram already does more on the read side than the plan assumed. `packages/pi-extension/src/tag.ts` rebuilds every recalled item in an `<engram:item>` tag, escapes content so stored text cannot open or close a tag, defuses forged tags in every other message, and withholds any memory_* result it did not produce. ADR 0004 and `policy/promotion.ts` (`leastTrusted`) already join integrity over lineage. So the earlier AB-SEC-5 was rightly dropped as "mostly built". What is missing is narrower and testable: (1) the tag shows provenance but its string form does not vary with trust tier (no datamark inside untrusted content, no tier-aware ordering), and the MCP path (C7) has no `context` hook; (2) there is no session taint: a model write made after the model read `external` or `model` content is stamped source `model`, not the least trusted of what it saw, so recall-then-write laundering is not caught by lineage; (3) there is no capability rule at the point of use (CaMeL's idea), such as "a tainted session may not promote or write to a shared scope"; (4) no preregistered arm measures any of it. All four can be pure functions in core (no model, no I/O), with string rendering in the surfaces. All candidates are ideas only: CaMeL (Apache-2.0) and FIDES (MIT) are Python research code, and LlamaFirewall's code sits in a Llama-licensed repo. No new literature notes were written because notes for 2403.14720, 2503.18813, 2505.23643 and 2505.03574 already exist.

## Landscape

| name | URL | licence | stars, last activity | language | what it gives us | absorb mode |
|---|---|---|---|---|---|---|
| Spotlighting 2403.14720 | arxiv.org/abs/2403.14720 | paper, no code found | n/a | n/a | transforming untrusted text to carry its origin; over 50 to under 2 percent attack success on GPT-family models (abstract). The names delimiting, datamarking, encoding are from memory of the paper | ideas only; string form in surfaces |
| CaMeL | github.com/google-research/camel-prompt-injection | Apache-2.0 | 425, last push 2025-06-20 (gh api, this session) | Python | capabilities on values checked at tool call; 77 percent of AgentDojo tasks provably secure vs 84 undefended (abstract) | ideas only |
| FIDES 2505.23643 | github.com/microsoft/fides | MIT (per 04-security, not re-verified) | 125, 2025-05-30 (per 04-security) | Python | integrity and confidentiality labels, deterministic policy, taint classification | ideas only |
| LlamaFirewall 2505.03574 | github.com/meta-llama/PurpleLlama | Llama community licence, GitHub NOASSERTION | 4,486, 2026-11-20 (per existing note); `gh api meta-llama/llamafirewall` returned 404 | Python | scanner pipeline shape; scanners are models | not absorbable, ideas only |
| A-MemGuard 2510.02373, 2607.05029 | existing notes | n/a | n/a | n/a | consensus defences, reported defeated | already covered |
| 2610.11188 | existing note | n/a | n/a | n/a | presentation matters little beside admission | tempers expectations |
| Engram `tag.ts`, `promotion.ts` | in repo | Apache-2.0 | n/a | TypeScript | escaping, defusing, `leastTrusted` join | extend |

Mapping. Spotlighting maps to deterministic rendering of provenance tier in the surfaces. CaMeL maps to a capability check at write and promote, driven by a taint set rather than a planner. FIDES maps to the two-axis label: integrity is provenance kind (exists), confidentiality is scope (ADR 0007 keeps model and compaction content in person scope, the join in practice). LlamaFirewall maps to nothing absorbable, and its scanners are models, which rule 4 keeps out of core.

## Where it fits

- **Core (pure, no model):** `trustTier(kind)` and `labelRecall(items)` giving per item `{kind, tier, lineage_depth}` from stored provenance; `sessionTaint(kindsSeen)` as `leastTrusted` over kinds read; a capability rule table in policy. No store I/O, no pi-ai.
- **pi context handler:** `tagMemoryResults` already rebuilds items from the record, so it calls `labelRecall` and renders marks by tier. The extension keeps a per-session taint set, updated when a read result is recorded, and passes it into the write.
- **C7 (MCP, no `context` filter):** the MCP server renders the same shared tag string, so marking works; taint is tracked per server session. C7 still cannot defuse forged tags in other messages, so the C7 minus C5 gap stays a stated limitation.
- **Limits:** a model may ignore marks, and 2610.11188 says presentation is weak. The taint rule is the enforceable part. Taint is coarse (it cannot tell which read item a write derived from), so it over-restricts. Utility cost must be measured (CaMeL's 77 vs 84 is the cautionary number).

## Preregistration arms (proposed amendments only, none registered)

- **Arm M (marking):** C5 with tier-aware datamarking against C5 as built, on MEM-INV-Bench attack cases. The preregistration already notes that under preset medium the plane admits every entry, so C5's read there is C2's plus the plane's tag; this is the one place presentation is isolated. Metric: HIT over HIT and REFUSED, as H1 scores it. Descriptive, outside Holm.
- **Arm T (taint):** C5 with session taint and a capability rule, on the same cases plus GateMem utility checkpoints for the cost. Primary: paired bootstrap of C5 minus C5T on HIT rate; secondary: utility delta. Both need the amendment reviewed before any run, and are cassette replayable (rules 6, 7).
- **Offline gate test, no model:** a property test that a write after a recall of `external` is never stamped more trusted than `external`.

## PR plans

### AB-GAP2-1: Preregistration proposal for read-side arms M and T
- **goal:** record arms M and T, metrics, sample (MEM-INV-Bench 456 sessions, GateMem utility) and analysis rule under "Proposed amendments, not yet registered".
- **absorbs:** Spotlighting, CaMeL, FIDES as design sources.
- **files:** `docs/research/preregistration.md`, `docs/log/`.
- **effort:** S. **depends on:** MP-09.
- **value:** thesis, a falsifiable read-side arm with the 2610.11188 prior stated. Product, none directly.
- **risks:** multiplicity creep; state both arms as descriptive.
- **acceptance:** `make lint-docs`.

### AB-GAP2-2: Core trust labels for recalled items
- **goal:** pure `labelRecall` and `trustTier` in core from stored provenance.
- **absorbs:** FIDES labels.
- **files:** `packages/core/src/plane/labels.ts`, `packages/core/src/index.ts`, `packages/core/test/property/labels.test.ts`.
- **effort:** S. **depends on:** none. Computed helper, so no schema change; if the label enters the generated contract, that is a schema PR first (rule 5).
- **value:** product, one source of truth for surfaces. Thesis, the join law gets a property test (monotone, idempotent, order-free).
- **risks:** duplicating `leastTrusted`, so reuse it. No licence risk.
- **acceptance:** `make test-one T=packages/core/test/property/labels.test.ts`.

### AB-GAP2-3: Tier-aware datamarking in the shared memory tag
- **goal:** render content of `model`, `compaction`, `tool`, `external` items with a deterministic datamark and origin attribute, higher tier first; default off; same string on pi and MCP.
- **absorbs:** Spotlighting.
- **files:** `packages/pi-extension/src/tag.ts`, `packages/mcp/src/server.ts`, their tests.
- **effort:** M. **depends on:** AB-GAP2-2.
- **value:** product, visible defence in depth on every harness. Thesis, arm M's implementation.
- **risks:** escaping and defusing tests must stay green; a mark could change what a benchmark scores, so default off with a runner switch.
- **acceptance:** `make test-one T=packages/pi-extension/test/tag.test.ts` with a golden per tier, and `make test-e2e`.

### AB-GAP2-4: Policy schema, taint_rules (schema-only PR)
- **goal:** optional policy block `taint_rules` (which tiers may promote or write to shared scopes once the session has read a given tier or worse); bump `schema_version`, migration, `make api`, fixtures; nothing else.
- **absorbs:** CaMeL capabilities, FIDES policy.
- **files:** `packages/core/src/schema.ts`, migration, generated `sdk/` and `packages/ui/src/api/`, fixtures.
- **effort:** M. **depends on:** none.
- **value:** product, an operator-set explainable rule. Thesis, makes arm T a policy rather than a code change.
- **risks:** Part I surface; additive, optional, default off; invariants must stay green.
- **acceptance:** `make api-check` and `make test-invariants`.

### AB-GAP2-5: Session taint in the write path
- **goal:** the plane evaluates `taint_rules` and stamps a write with `leastTrusted(taint, own kind)`; pi extension tracks taint per session from recorded reads, MCP per server session; each decision emits an event with a reason (rule 3).
- **absorbs:** CaMeL, FIDES.
- **files:** `packages/core/src/plane/write.ts`, `packages/core/src/policy/evaluate.ts`, `packages/pi-extension/src/extension.ts`, `packages/mcp/src/server.ts`, tests.
- **effort:** L. **depends on:** AB-GAP2-2, AB-GAP2-4.
- **value:** product, closes recall-then-write laundering. Thesis, the strongest read-side claim: a deterministic gate with no model.
- **risks:** over-restriction, interaction with `promote` and quarantine (MP-34), Part I regression, so default-off and after Gate D.
- **acceptance:** `make test-invariants` extended with a taint property, and `make test-one T=packages/core/test/property/taint.test.ts`.

### AB-GAP2-6: Runner arms M and T, offline replay
- **goal:** add arm switches to `CONDITION_TABLE` so M and T run from scripted models and committed cassettes; counts via `COUNT=1`.
- **absorbs:** none.
- **files:** `packages/runner/src/config.ts`, `packages/runner/src/conditions.ts`, `research/configs/`, `research/scripts/`, `research/results/MANIFEST.md`.
- **effort:** M. **depends on:** AB-GAP2-1 reviewed, AB-GAP2-3, AB-GAP2-5.
- **value:** thesis, the numbers, with rule 9 met. Product, none.
- **risks:** a live run needs the amendment and spend approval first.
- **acceptance:** `make run CONFIG=research/configs/<arm>.json COUNT=1`, then `make test-repro`.

### AB-GAP2-7: Read-side red-team cases
- **goal:** forged tag in a recalled item, recall of external text then promote, mixed-tier ordering, as gate tests in the red-team suite.
- **files:** red-team fixtures and the MP-28 bench.
- **effort:** S. **depends on:** MP-28, AB-GAP2-5.
- **value:** thesis, gate tests with no LLM. Product, a regression net.
- **risks:** none on licence (hand-written cases).
- **acceptance:** `make bench BENCH=redteam`.

## Recommended order

1. AB-GAP2-1: docs only, cheap, and every arm waits on its review.
2. AB-GAP2-2: tiny pure core helper, no schema, base for 3 and 5 with a property test.
3. AB-GAP2-3: the visible surface change and arm M, default off, so the 30 November tag is not at risk.

AB-GAP2-4 and 5 are the thesis-grade piece (a deterministic taint gate) but touch Part I code, so they belong after Gate D.

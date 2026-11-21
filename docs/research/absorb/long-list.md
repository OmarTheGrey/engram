# The long list: 166 plans

The merged output of the absorb and state-of-the-art research of 2026-11-21: the seventeen area reports, the four gap studies and the GitHub sweep in this folder, deduplicated into 166 plans. `docs/tasks/absorb-plan.md` selects the 30 pull requests the project commits to. Everything else here is a candidate, not a commitment.

The wave is the research's own placement: 0 before the pre-registration tag, 1 between Gate C and Gate D, 2 after Gate D. The sources column names the ids the area reports use (`AB-*`, and `MP-*` in `00-master-plan.md`) and the ids of the GitHub sweep (`GH-*` in `19-github-scout.md`).

## Wave 0

| id | plan | area | effort | depends on | sources |
|---|---|---|---|---|---|
| R-001 | Preregistration proposals batch for all new arms | research | S | none | MP-09, AB-SEC-4, AB-SOTA-3, AB-TWN-5, AB-RET-2, AB-RET-6, AB-FWK-7, AB-CMPT-2, AB-ING-5, GH-04, GH-12, GH-23, GH-56, GH-73, GH-60 |
| R-002 | Reposition the novelty claim against HEAMS and SAFE-Mem | research | S | none | 16-frontier-sweep (AB-SOTA), MP-09 (adjacent) |
| R-003 | Counterexample tests for trust bypasses (eviction, rewrite, unattested write) | security | S | none | GH-38 (verification half), GH-39 (verification half) |
| R-004 | Revocation conformance grid for adapters | stores | S | none | MP-03, AB-SOTA-1 |
| R-005 | Stateful model-based test of the Plane | formal | M | none | MP-06, AB-FRM-3, GH-41 (stateful half) |
| R-006 | Crash-window tests via test-side fault injection | formal | S | none | GH-21 |
| R-007 | Quint spec of the commit and erasure protocol | formal | M | none | MP-10, AB-FRM-1, GH-05 (transition) |
| R-008 | Claim-to-test crosswalk and obligation map | compliance | M | none | MP-04, AB-CMP-5 |
| R-009 | Plane-overhead benchmark and latency budget | performance | M | none | MP-05, AB-PRF-1, GH-35 (p95 budget) |
| R-010 | Conformance cases for validity, history and graph claims | stores | S | none | MP-07, AB-STO-1 |
| R-011 | Byte-stable results page and leaderboard | evalops | M | none | MP-08, AB-EVL-6 |
| R-012 | Supersession visibility property test | hygiene | S | none | GH-24 (test half) |
| R-013 | Test and bench hygiene: offline guard, hidden-call audit, scorers | evalops | S | none | GH-35 |
| R-014 | Memory-benchmark intake review (prereg proposal) | research | S | none | MP-02, AB-EVL-7 |
| R-015 | Preregistration proposal for read-side arms M (marking) and T (taint) | research | S | R-001 | MP-67 (read-side IFC addendum), AB-GAP2-1 |
| R-016 | ADR: agents and delegation without schema | multi-agent | S | none | MP-74, AB-GAP3-1 |
| R-017 | Memory-system baseline matrix and prereg proposal | research | S | R-001 | MP-61 (baselines addendum), AB-GAP4-1 |
| R-018 | ADR 0013 amendment for Mem0 v3 | stores | S | none | MP-01, AB-STO-7 |

## Wave 1

| id | plan | area | effort | depends on | sources |
|---|---|---|---|---|---|
| R-019 | Skill format in core (toSkillMd, parseSkillMd) | distill | S | none | MP-18, AB-DIS-1 |
| R-020 | Distill induction pipeline (AWM port), cards D1 and D2 | distill | L | R-019 | MP-19, AB-DIS-3 |
| R-021 | Replay validator and drift retirement, cards D3 and D4 | distill | L | R-020 | MP-20, AB-DIS-4 |
| R-022 | Cassette proxy in @engram/model | evalops | M | none | MP-17, AB-EVL-1 |
| R-023 | Trust-gated retire, evict and rewrite (invariant 8) | security | M | R-003 | GH-38 |
| R-024 | Unattested-write trust floor | security | M | R-003 | GH-39 |
| R-025 | Tombstone non-resurrection, erase epoch and stale-work discard | security | M | R-007 | GH-05 |
| R-026 | Policy content_guards schema PR | security | M | none | MP-14, AB-SEC-2, AB-CMPT-1 (schema half), GH-01 (schema), GH-02 (policy field) |
| R-027 | Write-gate secret and PII detectors with BLOCK and REVIEW tiers | security | M | R-026 | MP-15, GH-01, AB-SEC-2, AB-CMPT-1 |
| R-028 | Non-revival matrix and exercised-guarantees census | formal | M | R-005 | GH-41 |
| R-029 | Tamper-evident log design ADR | log | S | none | MP-21, AB-SEC-1, AB-CMP-2, AB-LOG-6, GH-07 (design) |
| R-030 | Erasure-compatible hash-chained event log | log | L | R-029 | MP-22, AB-SEC-1, AB-CMP-2, AB-LOG-6, GH-07 |
| R-031 | Cross-surface leakage and parity suites | security | M | none | GH-58 |
| R-032 | Cedar export with differential test | policy | M | none | MP-13, AB-POL-1 |
| R-033 | tau2 and MERIT harness wiring through the proxy | evalops | L | R-022, R-020, R-021 | MP-23, AB-DIS-5, AB-EVL-2 |
| R-034 | Near-duplicate lint tiers: MinHash with IDF-veto precision tier | hygiene | M | R-013 | MP-11, AB-RET-5, GH-18 |
| R-035 | Quote-grounding for model lints and extraction | hygiene | S | R-001 | GH-23 |
| R-036 | Retrieval bisect (ddmin blame finder) | retrieval | M | none | GH-10 |
| R-037 | Deterministic injection screen and provenance-conditioned detectors | security | M | R-026 | GH-02, MP-15b (proposed by GH-02) |
| R-038 | Red-team harness with AMSB corpus and benign controls | security | L | R-001, R-027 | MP-28, AB-SEC-4, GH-04 |
| R-039 | Inspector: provenance graph, event table, version diff | surfaces | M | none | MP-29, AB-SUR-3 |
| R-040 | Signed audit report | compliance | M | R-029 | MP-25, AB-CMP-1 |
| R-041 | Erasure residue benchmark | twin | M | R-001 | MP-26, AB-TWN-5 |
| R-042 | Gate mutation audit (frozen mutants, Stryker evaluated) | formal | M | none | GH-57, AB-FRM-5 |
| R-043 | Memory import and export bridge | twin | M | none | MP-16, AB-STO-3, AB-CMPT-7, AB-TWN-3 |
| R-044 | Declarative policy tests | policy | S | none | MP-12, AB-POL-4 |
| R-045 | Distiller prompt data wrapper and shared confusable fold | security | S | none | GH-36 |
| R-046 | Core trust labels for recalled items | security | S | none | MP-68 (read-side IFC addendum), AB-GAP2-2 |
| R-047 | Authority fence and tier-aware datamarking on every read surface | security | M | R-046, R-045 | GH-03, MP-69 (read-side IFC addendum), AB-GAP2-3 |
| R-048 | MCP surface hardening | surfaces | M | none | GH-69 |
| R-049 | Delegation and inheritance invariant | multi-agent | M | R-016 | MP-75, AB-GAP3-2 |
| R-050 | Two-agent conflict and shared-store probes | multi-agent | M | none | MP-77, AB-GAP3-4 |
| R-051 | Cross-agent fault scenarios (confused deputy, cross-agent poisoning) | multi-agent | M | R-001 | MP-76, AB-GAP3-3 |
| R-052 | Paired fault-injection arm for H3 | research | M | R-001 | MP-27, AB-SOTA-3 |
| R-053 | Store-enforced immutability on the event table | log | S | R-029 | GH-08 |
| R-054 | engram diff: keyed state diff between two points (read-only) | surfaces | M | none | GH-16 (diff half) |
| R-055 | Supersession helper proposing valid_to | hygiene | S | none | MP-24, AB-HYG-3 |
| R-056 | Supersession head resolver and visibility-aware supersession | hygiene | S | R-012 | GH-24 (code half) |
| R-057 | Governed hooks: Codex first, with idempotent installer | surfaces | M | none | MP-32, AB-SUR-5 (Codex half), GH-20 (installer and compact re-injection) |
| R-058 | Harness memory classifier and engram discover (counts only) | approval | M | none | MP-61 (approval addendum), AB-GAP1-5 |
| R-059 | Doctor check and hook feed for discovered memories | approval | S | R-058 | MP-66 (approval addendum), AB-GAP1-6 |
| R-060 | Log backup and resumable event tail | log | S | none | MP-30, AB-LOG-2, AB-LOG-5 |
| R-061 | AI-BOM (CycloneDX 1.7) | compliance | S | none | MP-33, AB-CMP-4 |
| R-062 | Quarantine and hold via candidate status | security | M | R-027 | MP-34, AB-SEC-6, GH-61 |
| R-063 | mcp-memory JSONL store adapter | stores | M | none | GH-19 (first adapter) |
| R-064 | Dry-run migration plan with row-count invariant | log | S | none | GH-29 |
| R-065 | ADR and claims hygiene tooling | evalops | M | R-008 | GH-67 |
| R-066 | ADR amending ADR 0009 for an optional dense tier | retrieval | S | R-001 | MP-31, AB-RET-2 (design), AB-RET-3 (design) |

## Wave 2

| id | plan | area | effort | depends on | sources |
|---|---|---|---|---|---|
| R-067 | HEAMS privacy and sovereignty suites as a research-side comparison harness | research | M | R-002, R-001 | 16-frontier-sweep (HEAMS, not planned as a PR) |
| R-068 | derived_from edges: schema PR (single shared PR) | log | M | R-026 | MP-54 (PR A), MP-65 (baselines addendum), AB-SOTA-2, AB-GAP4-5, GH-06 (a) |
| R-069 | Stale-dependency lint and logged cascade over derived_from | hygiene | M | R-068 | GH-06 (b, c) |
| R-070 | Authority ceiling on derived items and promotion hardening | security | M | R-068 | MP-54 (PR B), AB-SOTA-2, GH-25 |
| R-071 | Retraction with impact report, un-retraction and source revocation | hygiene | L | R-069, R-025 | GH-40 |
| R-072 | Read manifest, itemised exclusions and replayable reads | log | M | R-064 | GH-11 |
| R-073 | Why-not-found explain and empty-result warnings | retrieval | M | R-072 | GH-46 |
| R-074 | Policy schema: taint_rules and privileged_actions (schema-only PR) | security | M | R-026 | MP-70 (read-side IFC addendum), AB-GAP2-4, GH-53 (policy field) |
| R-075 | Session taint in the write path and privileged-action gate | security | L | R-074, R-046, R-024 | MP-71 (read-side IFC addendum), AB-GAP2-5, GH-53 |
| R-076 | Approval request id and policy approval block (schema PR) | approval | S | R-026 | MP-62 (approval addendum), AB-GAP1-1 |
| R-077 | Compare-and-set writes, review head-binding, idempotency key | log | M | R-064 | GH-09 |
| R-078 | Approval projection, held-write queue, routing, expiry and Plane.approve | approval | M | R-076, R-077 | MP-63 (approval addendum), AB-GAP1-2, GH-55 |
| R-079 | Approvals on CLI, server and MCP tools | approval | M | R-078 | MP-64 (approval addendum), AB-GAP1-3 |
| R-080 | Inspector approval queue screen | approval | M | R-079 | MP-65 (approval addendum), AB-GAP1-4 |
| R-081 | Verified actors: token authentication and keyed server access | surfaces | L | none | MP-46, AB-SUR-1, AB-CMPT-4, GH-28 |
| R-082 | Who can read this memory | policy | M | none | MP-45, AB-POL-3 |
| R-083 | Key-metadata schema PR for erasure | twin | S | R-029 | MP-51, AB-TWN-1a |
| R-084 | Crypto-shredded erasure with tested cipher and key provider | twin | L | R-083, R-030, R-041 | MP-50, AB-TWN-1, GH-31 |
| R-085 | Signed erasure receipt and residue verification | twin | L | R-084 | GH-48 |
| R-086 | Deferred second sweep and erasure reach across derived copies | twin | M | R-085 | GH-49 |
| R-087 | Write-side consent: do-not-record and derivation opt-out | twin | M | R-083 | GH-27 |
| R-088 | Withhold field schema PR | twin | S | none | MP-52, AB-TWN-2 (schema half) |
| R-089 | Encrypted person scope with Incognito, Forget, Withhold | twin | L | R-084, R-088, R-087 | MP-53, AB-TWN-2 |
| R-090 | DSAR export, closure report and Art. 30 record | compliance | M | R-043 | MP-55, AB-CMP-7, AB-CMPT-6 |
| R-091 | Re-ingestion write barrier | security | M | none | GH-62 |
| R-092 | Recall feedback and outcome events (Memory Worth) | retrieval | M | R-077, R-001 | GH-12 |
| R-093 | Distill live-use outcome projection and contested rule | distill | M | R-092 | GH-43 |
| R-094 | Distill inputs and admission checks (cross-harness session parsers) | distill | M | R-020 | GH-34 |
| R-095 | Three-valued validation, derived evidence grade, freshness binding | distill | M | R-094 | GH-42 |
| R-096 | Procedure safety scan as a Distill admission lint | distill | M | R-094 | GH-37 |
| R-097 | Cross-family model guard | hygiene | M | none | GH-44 |
| R-098 | Session integrity and transcript importers | ingestion | M | R-094 | GH-66 |
| R-099 | Per-class recency constant (schema PR) | retrieval | S | none | MP-35, AB-RET-1 (schema half) |
| R-100 | Recency per class and retired-never-revived ranking property | retrieval | M | R-099 | MP-36, AB-RET-1 (logic half) |
| R-101 | policy_hash on events (schema PR) | log | S | none | MP-43, AB-POL-5 (BCEAC binding) |
| R-102 | Policy content hash, signed policy packs and read replay under a stored policy | policy | M | R-101 | GH-32, GH-72 |
| R-103 | Shadow mode and policy lifecycle | policy | M | R-102 | GH-51 |
| R-104 | Policy diff (structural) and ceiling gate | policy | M | none | MP-42, AB-POL-5 (structural half) |
| R-105 | Analyzer-backed invariants and semantic policy diff | formal | M | R-032, R-104 | MP-44, AB-POL-2, AB-POL-5 (semantic half) |
| R-106 | Dense tier schema PR (policy option) | retrieval | S | R-066 | MP-37, AB-RET-2 (schema half) |
| R-107 | Explainable hybrid dense tier in core and lexical ranking components | retrieval | M | R-106 | MP-38, AB-RET-2, GH-14 |
| R-108 | Local embedder and vector cache (packages/embed) | retrieval | M | R-107 | MP-39, AB-RET-3 |
| R-109 | Retrieval ablation harness and explanation views | research | M | R-107, R-108, R-001 | MP-40, AB-RET-6 |
| R-110 | Semantic near-duplicate lint | hygiene | M | R-034, R-108 | MP-41, AB-RET-4 |
| R-111 | Governed deterministic decay (retention.decay) with source ceiling | hygiene | M | R-001 | MP-64 (baselines addendum), AB-GAP4-4, GH-13 |
| R-112 | Retention max-TTL, blast-radius cap, preview and keep | hygiene | M | none | GH-70 |
| R-113 | Retention templates per regulation | compliance | M | none | MP-58, AB-CMP-6 |
| R-114 | Org kill switch, halt and break-glass window | compliance | M | R-030 | MP-57, AB-CMPT-5, GH-30 |
| R-115 | Known-at (belief-time) read and bitemporal as-of API | log | M | none | GH-45, AB-LOG-3 |
| R-116 | Runner arms M (marking) and T (taint), offline replay | research | M | R-015, R-047, R-075 | MP-72 (read-side IFC addendum), AB-GAP2-6 |
| R-117 | Poisoning arms: interference, action outcome and read-side red-team cases | security | L | R-038, R-075, R-001 | GH-73, MP-73 (read-side IFC addendum), AB-GAP2-7 |
| R-118 | ForgetEval arm with null floors | research | M | R-025, R-001 | GH-56 |
| R-119 | Token budget, coverage honesty and progressive disclosure | retrieval | M | R-072 | GH-15 |
| R-120 | Abstain outcome and evidence status on recall | retrieval | M | R-119 | GH-47 |
| R-121 | Governed revert of causal groups | surfaces | M | R-054, R-077 | GH-16 (revert half) |
| R-122 | Three-way item merge and merge-resolution policy | multi-agent | M | R-077 | GH-17 |
| R-123 | Anchor-based staleness lint and commit-anchored validity | hygiene | M | R-068 | GH-22 |
| R-124 | Population-level, read-behaviour and usage lints | hygiene | M | R-001 | GH-26, GH-63 |
| R-125 | Keyed deterministic conflict lints and fact table | hygiene | M | R-068, R-001 | GH-60, AB-HYG-2 |
| R-126 | Deterministic grounding and claim-without-evidence floor | hygiene | M | R-035 | GH-64 |
| R-127 | Item seal and per-actor keyring | security | L | R-030 | GH-50 |
| R-128 | Write lease with fencing token | multi-agent | L | R-077 | GH-52 |
| R-129 | Delegation: delegated_by and narrowing-only grants for sub-agents | multi-agent | L | R-081, R-049, R-024, R-077 | MP-78, AB-GAP3-5, GH-54 |
| R-130 | Governed publish with egress gate | compliance | L | R-027 | GH-59 |
| R-131 | Portable verifier bundle and standalone Python verifier | log | M | R-030 | GH-07 (bundle half) |
| R-132 | OpenLineage and SBOM exports | compliance | S | R-043 | GH-33 |
| R-133 | Migration parity, postconditions and reader floor | log | M | R-064 | GH-68 |
| R-134 | Hook lifecycle, capture and plugin packaging | surfaces | L | R-057, R-047, R-037 | GH-65, GH-20 (remainder) |
| R-135 | Governed hooks: Cursor and Gemini CLI | surfaces | M | R-057 | MP-49, AB-SUR-5 (rest) |
| R-136 | MCP SDK v2 migration | surfaces | M | none | MP-47, AB-SUR-2 |
| R-137 | MCP resources and prompts | surfaces | M | R-136, R-081 | MP-48, AB-SUR-6 |
| R-138 | Audit and telemetry export (OpenTelemetry) | evalops | M | none | MP-56, AB-EVL-3, AB-CMPT-3 |
| R-139 | Framework kit: core by-id read and scope list | frameworks | M | none | MP-59 (a), AB-FWK-1 |
| R-140 | Vercel AI SDK middleware (@engram/ai-sdk) | frameworks | S | R-139 | MP-59 (b), AB-FWK-3 |
| R-141 | LangGraph BaseStore adapter | frameworks | M | R-139 | MP-59 (c), AB-FWK-2, AB-STO-4 |
| R-142 | Mastra Processor step one | frameworks | M | R-139 | MP-59 (d), AB-FWK-4 |
| R-143 | Framework conformance suite with a prereg condition | frameworks | M | R-140, R-141, R-142, R-001 | MP-59 (e), AB-FWK-7 |
| R-144 | Ingestion: span locator schema PR | ingestion | M | none | MP-60 (card 1), AB-ING-1 |
| R-145 | Ingestion: governed ingest pipeline and memory_ingest | ingestion | L | R-144 | MP-60 (card 2), AB-ING-2 |
| R-146 | Ingestion: URL ingest with SSRF guard | ingestion | M | R-145 | MP-60 (card 3), AB-ING-3 |
| R-147 | Ingestion: source re-verification | ingestion | M | R-145 | MP-60 (card 4), AB-ING-4 |
| R-148 | Ingestion: poisoning fault set | ingestion | M | R-145, R-001 | MP-60 (card 5), AB-ING-5 |
| R-149 | Further store adapters and importers | stores | M | R-063 | GH-19 (rest) |
| R-150 | Governed consolidation job with model verdicts and phase cost ledger | hygiene | L | R-068, R-034, R-103 | MP-66 (baselines addendum), AB-GAP4-5 (B), AB-HYG-4 (superseded), GH-71 |
| R-151 | Sleep-time consolidation scheduler | hygiene | M | R-150 | MP-67 (baselines addendum), AB-GAP4-6 |
| R-152 | Algorithm-port baselines (A-Mem links, MemoryOS tiers) | research | L | R-017, R-022 | MP-62 (baselines addendum), AB-GAP4-2 |
| R-153 | External store sidecar adapter harness | stores | L | R-017, R-022 | MP-63 (baselines addendum), AB-GAP4-3 |
| R-154 | Supermemory adapter spike (memo only) | stores | S | R-017 | MP-68 (baselines addendum), AB-GAP4-7 |
| R-155 | Agent Skills import and export with write-gate scan | distill | L | R-019, R-021 | AB-DIS-2 (backlog) |
| R-156 | Skill lifecycle surfaces | distill | S | R-155 | AB-DIS-6 (backlog) |
| R-157 | Trace2Skill merge method (evaluate) | distill | S | R-001 | AB-DIS-7 (backlog) |
| R-158 | Injection classifier lint (model-based tier) | security | M | R-038, R-037 | AB-SEC-3 (backlog), AB-CMPT-2 |
| R-159 | Local NLI contradiction tier | hygiene | L | R-125 | AB-HYG-1 (backlog) |
| R-160 | MiniCheck and AlignScore baseline | research | M | R-001 | AB-HYG-5 (backlog) |
| R-161 | Parquet export | log | M | R-043 | AB-LOG-1 (backlog) |
| R-162 | Quint trace replay against the Plane | formal | M | R-007 | AB-FRM-2 (backlog) |
| R-163 | Memoised projection | performance | M | R-009 | AB-PRF-2 (backlog) |
| R-164 | Performance backlog: SQLite profiles, write trimming, load test, SEA binary | performance | M | R-009 | AB-PRF-3, AB-PRF-4, AB-PRF-5, AB-PRF-6, AB-PRF-7 (skipped) |
| R-165 | Python client and docs site | surfaces | M | none | AB-SUR-4, AB-SUR-7 (backlog) |
| R-166 | OSCAL export | compliance | S | R-008 | AB-CMP-3 (backlog) |

## Not absorbable

Licence, maintenance or fit ruled these out as code. Several remain worth reading.

| source | licence | reason |
|---|---|---|
| Llama Prompt Guard 2 | Llama licence | Licence is not open source; LlamaFirewall likewise |
| Gemma-licensed embedding models | Gemma licence | Licence terms exclude them from the pinned dependency set |
| fastembed-js | Apache-2.0 | Archived upstream |
| llm-guard | MIT | Archived upstream |
| k6 | AGPL-3.0 | AGPL; load testing is an idea only |
| CIRCL/compliance | AGPL-3.0 | Ideas only (Art. 30 field list); nothing copied |
| yild/gdprropa | GPL-3.0 | Ideas only; nothing copied |
| elkjs | EPL-2.0 OR GPL | Copyleft layout engine; dagre used instead |
| HaluMem | CC-BY-NC-ND | Code and data non-commercial and no-derivatives; decided out |
| XTDB | MPL-2.0 | Vocabulary only |
| anthropics/skills | no single licence reported | Per-folder Apache-2.0 fixtures only; do not vendor wholesale |
| Graphiti and Zep service, LongMemory, cognee REST | Apache-2.0 (service dependencies unconfirmed) | Vendor model calls break rules 6 and 7; server dependency; no consumer for native validity (interval logic is ported as a pure function only) |
| @firfi/quint-connect | unverified | Pulls in effect, 15 stars, inside the two-week window; vendor a small ITF reader instead |
| @cedar-policy/cedar-wasm 4.14.1 | Apache-2.0 | Empty npm publish; pin 4.14.0 |
| jose 6.2.18, OTel exporter 0.301.2, xyflow 13.0.x, better-auth 1.7.x | various | Under two weeks old; use the older pin or wait |
| Mastra ee/ directory | enterprise carve-out | Enterprise licence |
| Tessera and Rekor | Apache-2.0 | Go services; design references only |
| Docling weights | unverified | Licence unverified; audio transcripts skipped |
| Inspect AI adapter, promptfoo | MIT/various | Duplicate the runner results path and existing tests |
| plastic-labs/honcho | AGPL-3.0 | Ideas only (derivation graph, erase epoch, observe_me); no code, no dependency |
| volcengine/OpenViking | AGPL-3.0 | Ideas only (tiered budgeted assembler) |
| basicmachines-co/basic-memory | AGPL-3.0 with CLA | Clean-room grammar only; format is not copyrightable |
| oraios/serena | GPL-3.0 (SolidLSP MIT) | Ideas only (tool profiles, hook auto-approve) |
| samvallad33/vestige | AGPL-3.0 | Related work (FSRS decay) |
| ZIZKA-AI-SL/ZizkaDB | AGPL-3.0 | Related work for the hash chain |
| JinHo-von-Choi/anchormind | AGPL-3.0-only | Ideas only; no code read while writing plans |
| fjwood69/mori | AGPL-3.0 | Ideas only (interference arm, counts-only rule) |
| aureliocpr-ctrl/verimem | AGPL-3.0 | Ideas only (admit-but-hold, detectors) |
| TiMEM-AI/TiMEM | dual, core Apache-2.0, other paths unverified | Much is placeholder code; idea for a later consolidation card |
| LucieEveille/kiwi-mem, Gwendolenmave/mnemosyne, YourMemory | unverified or other | Check LICENSE before reading deeper; do not copy |
| vanzan01/cursor-memory-bank | none declared | No licence; do not copy |
| kody-hq/kody | NOASSERTION | Look for a real LICENSE before any reuse |
| huqan lib/saml, lib/oidc, lib/siem, lib/evidence-pack | proprietary enterprise licence | Never copy; only the Apache paths are ported |
| TruffleHog | AGPL-3.0 (reported) | Do not depend on it for the egress gate |
| OpenMemory-derived SimHash in metronix-memory | unlicensed | Do not copy |
| XNLI data used by powercontext | CC BY-NC | Never reuse |
| huggingface/funes-integrations converters | no licence | Read for shapes only |
| Docling sidecar and audio transcripts | n/a | Skipped: low value |

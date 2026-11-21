# 07-evalops: evaluation harnesses, record and replay, observability, dashboards (prefix AB-EVL)

## Executive summary

ADR 0036's proxy should not be built on an absorbed proxy. The 2026 OpenAI-compatible cassette proxies I found (retake, tapelock, llm-cassette) have 0 to 2 stars and were created Sep to Oct 2026, so nothing mature exists to vendor. The mature pieces are ideas: vcrpy's record modes and matcher, LiteLLM's whole-request cache key (the Python harnesses already run through LiteLLM), and tapelock's "replay never falls back upstream" rule. The proxy is about 300 lines on `node:http` in `@engram/model`, reusing ADR 0017's key and cassette files, so no new dependency is needed. For frameworks, Inspect AI (MIT, active, `ModelAPI` plug-in, static log viewer bundle) is the right host for Engram's conditions as eval tasks. promptfoo (MIT, TypeScript) suits product regression in CI. For observability, the OpenTelemetry GenAI conventions fit an events-to-spans exporter, but all of it is still marked Development, so pin the version and isolate the mapping. Langfuse core is MIT but has ee/ directories; Phoenix is Elastic License 2.0 and not absorbable. HaluMem's code and data are CC-BY-NC-ND 4.0 and not absorbable, which is already in its note. A static dashboard built from `research/results/` fits the "no result unless a script regenerates it" rule better than any hosted tool.

## Landscape

All stars, licences and dates are from the GitHub API on 2026-11-21 unless stated.

| Name | URL | Licence | Stars, last push | Lang | What it gives us | Mode |
|---|---|---|---|---|---|---|
| Inspect AI 0.3.291 | github.com/UKGovernmentBEIS/inspect_ai | MIT | 3,302, 2026-11-20 | Python | Tasks, `ModelAPI` provider plug-in, cache, `inspect view bundle` static viewer | depend (research/ only) |
| inspect_evals | github.com/UKGovernmentBEIS/inspect_evals | MIT | 750, 2026-11-20 | Python | Reference task layouts, benchmark ports | ideas |
| promptfoo | github.com/promptfoo/promptfoo | MIT | 27,511, 2026-11-21 | TS | YAML suites, custom TS provider, CI assertions | depend (dev) |
| DeepEval | github.com/confident-ai/deepeval | Apache-2.0 | 19,582, 2026-11-19 | Python | Metric library (LLM judges); I did not read its memory plug-ins | ideas |
| lm-evaluation-harness | github.com/EleutherAI/lm-evaluation-harness | MIT | 14,515, 2026-11-04 | Python | Task YAML conventions; not agent-shaped | ideas |
| openai/evals | github.com/openai/evals | NOASSERTION (not read) | 19,774, 2026-04-14 | Python | Superseded; ideas only | ideas |
| vcrpy 9.4.2 | github.com/kevin1024/vcrpy | MIT | 3,024, 2026-11-17 | Python | Record modes, matchers, in-process fallback for Python harnesses | ideas, optional depend |
| LiteLLM | github.com/BerriAI/litellm | MIT outside `enterprise/` | 63,643, 2026-11-21 | Python | Harnesses' own client; whole-request cache key, base URL override | ideas (use as client) |
| mitmproxy | github.com/mitmproxy/mitmproxy | MIT | 47,117, 2026-11-19 | Python | Generic fallback for non-OpenAI routes | ideas |
| retake / tapelock / llm-cassette | github.com/Zecrari/retake, tapelock/tapelock, gangjig/llm-cassette | MIT, Apache-2.0, MIT | 0, 2, 1; Sep to Nov 2026 | HTML, Go, Python | Same job as ADR 0036; too young to trust | ideas only |
| OTel GenAI semconv | github.com/open-telemetry/semantic-conventions-genai | Apache-2.0 | 556, 2026-11-21 | spec | `invoke_agent`, `execute_tool`, retrieval spans, `gen_ai.request.seed` (Development) | port (mapping) |
| @opentelemetry/api, sdk-trace-base, exporter-trace-otlp-http | npm | Apache-2.0 | 1.10.0, 2.12.0, 0.301.0 (pin; 0.301.2 is latest but under two weeks old) | TS | The export SDK | depend |
| OpenInference | github.com/Arize-ai/openinference | Apache-2.0 | 1,333, 2026-11-21 | Py/TS | Alternative span vocabulary used by Phoenix | ideas |
| Langfuse | github.com/langfuse/langfuse | MIT outside ee/ dirs (LICENSE read) | 37,691, 2026-11-21 | TS | OTLP ingest, trace UI, self-hostable (needs services, not embeddable) | ideas, OTLP target |
| Arize Phoenix | github.com/Arize-ai/phoenix | Elastic License 2.0 (LICENSE read) | 12,367, 2026-11-21 | Python | Trace UI | NOT absorbable, ideas only |
| MemoryAgentBench | github.com/HUST-AI-HYZ/MemoryAgentBench | MIT | 492, 2026-09-25 | Python | In the preregistration's table, but H4 now runs on GateMem only (decision sheet item 24, ADR 0035), so it needs the proxy only if card B9 is kept | already covered, status uncertain |
| HaluMem | github.com/MemTensor/HaluMem | CC-BY-NC-ND 4.0 on code and data (LICENSE.txt; preregistration.md and PINS.md agree) | 181, 2026-10-28 | Python | Operation-level memory eval | NOT absorbable, ideas only |
| SciPy / statsmodels | PyPI | BSD-3-Clause | 15,231 / 11,759 | Py | `scipy.stats.bootstrap` (BCa), tests | depend (research/) |
| arch 9.0.0 | github.com/bashtage/arch | NCSA (PyPI metadata; GitHub API says NOASSERTION), permissive and Apache-compatible | 1,690 | Py | Bootstrap and multiple-testing helpers | depend (research/), not needed: SciPy covers BCa |
| pingouin 0.7.0 | PyPI | GPL-3.0 | n/a | Py | Stats helpers | NOT absorbable |

Not verified: pollyjs (Netflix/pollyjs, Apache-2.0, 10,250 stars) was last pushed 2025-05-31, so it is stale and browser-oriented. I did not find or verify MemSim or Mem-Gallery. MemBench (arXiv:2506.21605) is 2025, cited in search results only.

Newer memory benchmarks seen in search (titles and abstracts only, none audited): LongMemEval-V2 (arXiv:2605.12493, 451 questions, CC BY 4.0 paper, no code link), Memora (2604.20006, titled "From Recall to Forgetting: Benchmarking Long-Term Memory for Personalized Agents"; I did not confirm that its benchmark is named Memora), AgentMemBench (2608.00009), StreamMemBench (2606.14571), DolphinBench (2609.24971), MemDerive (2610.25373), MemDelta (2606.29914) and EvalMem (2609.22231), both in notes. Check each one's data licence before any plan.

## PR plans

### AB-EVL-1: Cassette proxy in `@engram/model`
- **goal:** ADR 0036's loopback OpenAI chat-completions proxy, replay by default, record under the live flags only, refused under `ENGRAM_OFFLINE=1`.
- **absorbs:** vcrpy's record-mode vocabulary (`none`, `new_episodes`), tapelock's no-upstream-fallback rule, LiteLLM's cache-hit header. No code vendored, no dependency.
- **files:** `packages/model/src/proxy.ts`, `packages/model/test/proxy.test.ts` (conformance against `cached.ts` on the same cassette), `packages/cli/src` (an `engram cassette-proxy` command, or `make proxy`), `Makefile`, `AGENTS.md` command list, `docs/log/`.
- **effort:** M
- **depends on:** ADR 0036 (accepted), ADR 0017, card RV6 (merged).
- **value:** Closes rules 6 and 7 for MERIT and tau2 (and MemoryAgentBench only if card B9 survives; H4 is GateMem-only under decision item 24) in about one card instead of weeks of porting. Needs a card file in `docs/tasks/` first (ADR 0036 says cards follow). Thesis: Part I's benchmark results regenerate offline for examiners.
- **risks:** Harnesses using streaming, tool-call or embeddings routes; return a 501 naming the route, never pass through. Seed: the proxy must inject it from config, not trust the harness.
- **acceptance:** `make test-one T=packages/model/test/proxy.test.ts`, which replays a recorded cassette through the proxy and byte-compares with the runner's reply, and asserts a miss is a 4xx with the key.

### AB-EVL-2: Python harness wrapper that forces the proxy
- **goal:** The ADR 0036 config check: a harness whose endpoint is not the proxy is refused.
- **absorbs:** LiteLLM's base-URL override as the client side; vcrpy as an optional in-process belt-and-braces check.
- **files:** `research/scripts/harness_guard.py`, `research/configs/` entries for MERIT and tau2 once their harness cards land (none exist yet; MemoryAgentBench only if B9 is kept). No vcrpy: it would add a dependency for a check the proxy already makes.
- **effort:** S to M (blocked on the harness cards, which do not exist yet)
- **depends on:** AB-EVL-1.
- **value:** Thesis: the config is the evidence for "no unseeded call".
- **risks:** A configuration check is not a network control, as ADR 0036 states. Licences: LiteLLM MIT outside `enterprise/`, vcrpy MIT.
- **acceptance:** `uv run pytest research/tests/test_harness_guard.py`, where a config naming another endpoint exits non-zero.

### AB-EVL-3: OTel GenAI export of Engram events
- **goal:** Map MemoryEvents and session entries to spans and ship them over OTLP/HTTP, off by default.
- **absorbs:** OTel GenAI conventions (port the mapping); `@opentelemetry/api` 1.10.0 (published 2026-10-20), `sdk-trace-base` 2.12.0 (2026-10-06), `exporter-trace-otlp-http` 0.301.0 (2026-11-05, 16 days old; 0.301.2 is only 9 days old, so it fails the two-week rule until 2026-11-26).
- **files:** `packages/otel/` (new, outside core), `packages/pi-extension` (optional hook), `packages/cli` (`engram serve --otlp <url>`), `docs/deps.md`, an ADR.
- **effort:** M
- **depends on:** none in the plane; ADR on the attribute map. Rule 1: the mapping is a pure function in the new package, no policy.
- **value:** Product: Engram traces appear in Langfuse, Datadog or any collector with decision and reason. Thesis: a live explain view.
- **risks:** Spec is Development; content must stay out of spans (rule 12); all licences Apache-2.0. Do not ship Phoenix integration (ELv2).
- **acceptance:** `make test-one T=packages/otel/test/mapping.test.ts`, which asserts a golden span set for `fixtures/workspaces/inspector/workload.json` using the SDK's in-memory exporter.

### AB-EVL-4: Inspect AI adapter exposing C1 to C5 as tasks
- **goal:** A `research/engram_inspect/` package with one task per benchmark, a `ModelAPI` reading the proxy, and a scorer that calls the vendored upstream judges.
- **absorbs:** Inspect AI (MIT), pattern of `inspect_evals`.
- **files:** `research/engram_inspect/`, `pyproject.toml`, `research/configs/inspect-*.json`, `docs/deps.md`, an ADR (Inspect hosts, runner owns results).
- **effort:** L
- **depends on:** AB-EVL-1, AB-EVL-2.
- **value:** Standard format other groups can run; the viewer bundle doubles as a log browser. Thesis: external validity.
- **risks:** Two result sets. Mitigate: replay only, results regenerated by `research/scripts/`. Inspect's own cache must be off.
- **acceptance:** `uv run inspect eval research/engram_inspect/tasks.py@gatemem_fixture --model engram-proxy/replay` matches `make bench BENCH=gatemem` per-item outcomes.

### AB-EVL-5: promptfoo policy regression suite
- **goal:** A YAML suite and TS provider running write refusals, scope leaks and grant checks through the generated SDK.
- **absorbs:** promptfoo (MIT), as a dev dependency.
- **files:** `packages/cli/promptfoo/` or `tests/policy-suite/`, `package.json`, `docs/deps.md`.
- **effort:** S
- **depends on:** none.
- **value:** Product CI readable by non-authors. Overlaps `make test-invariants`, so keep it small.
- **risks:** Large dependency tree; dev-only pin.
- **acceptance:** `pnpm exec promptfoo eval -c <config> --no-cache` passes on `fixtures/workspaces/inspector`.

### AB-EVL-6: Results dashboard and leaderboard page
- **goal:** A static, byte-stable site from `research/results/` (H1 table and figure, MANIFEST sha256s, cost, defect-code view after EvalMem), with a "re-run command" per row.
- **absorbs:** `inspect view bundle` (for logs, if AB-EVL-4 lands); EvalMem's diagnostic idea. Hand-written SVG like `h1_figure.py`.
- **files:** `research/scripts/dashboard.py`, `research/configs/dashboard.json`, `research/results/MANIFEST.md`, `Makefile` (`make dashboard`).
- **effort:** M
- **depends on:** AB-EVL-4 only for the log view; the rest depends on nothing.
- **value:** Thesis: examiners see every claim beside its hash. Product: public page.
- **risks:** Must not include dogfood data (rule 12); numbers only from MANIFEST rows.
- **acceptance:** `make test-repro` includes the dashboard row and `make dashboard` twice gives the same sha256.

### AB-EVL-7: Memory-benchmark intake review
- **goal:** A preregistration proposal reviewing LongMemEval-V2 and others for admissibility, data licence and cost.
- **absorbs:** none; methods from MemDelta (stratify by model).
- **files:** `docs/research/preregistration.md` (proposal only), `docs/log/`.
- **effort:** S
- **depends on:** none. AGENTS.md: no benchmark outside the preregistration.
- **value:** Thesis: decides what to add before any run.
- **risks:** Several candidates have no code link yet; HaluMem is CC-BY-NC-ND.
- **acceptance:** `make lint-docs`.

## Recommended order

1. **AB-EVL-1.** It unblocks three benchmarks and costs about one card; it needs no dependency.
2. **AB-EVL-3.** Independent of the proxy, visible in any demo, all Apache-2.0 dependencies.
3. **AB-EVL-6.** Cheap, no new dependency, and it makes the thesis claims inspectable. AB-EVL-4 follows once the proxy is in.

## Notes written

In `.claude/worktrees/research/docs/readings/litreview/`: `repo-inspect-ai.md`, `repo-otel-genai-semconv.md`, `repo-promptfoo.md`, `repo-llm-cassette-proxies.md`, `2606.29914-memdelta.md`, `2609.22231-evalmem.md`. The last two read the arXiv abstract page only.

## Verification (2026-11-21)

**Checked from source.** GitHub API for stars, licence, push date and creation date of every repo in the landscape table; npm for the three OpenTelemetry packages (licence, version and per-version publish time); PyPI for inspect-ai 0.3.291 (MIT), vcrpy 9.4.2 (MIT), pingouin 0.7.0 (GPL-3.0), arch 9.0.0 (NCSA), statsmodels (BSD-3-Clause); the LICENSE files of LiteLLM (MIT outside `litellm/enterprise/`) and Langfuse (MIT outside `ee/` directories); SciPy and statsmodels stars. arXiv abs pages for 2606.29914 (MemDelta, author Kuan Wang), 2609.22231 (EvalMem, EMNLP 2026 Findings, CC BY 4.0), 2605.12493, 2604.20006, 2608.00009, 2606.14571, 2609.24971, 2610.25373 and 2506.21605. All ids resolve; titles match the notes.

**Corrected.**
- HaluMem is CC-BY-NC-ND on its code as well as its data (preregistration.md and PINS.md agree); still ideas only.
- arch is NCSA (PyPI), permissive; the "not verified" is resolved, and it is not needed because SciPy has BCa.
- Star counts: promptfoo 27,511, LiteLLM 63,643. retake's language is HTML per the API.
- `@opentelemetry/exporter-trace-otlp-http` 0.301.2 was published 2026-11-12, under the two-week rule; the plan now pins 0.301.0 (2026-11-05) until 2026-11-26. The other two are old enough.
- MemoryAgentBench is no longer H4's second arm (decision sheet item 24, ADR 0035: H4 on GateMem only). AB-EVL-1 and AB-EVL-2 no longer count it as a certain client of the proxy.
- Memora (2604.20006): the arXiv title is "From Recall to Forgetting: ..."; I could not confirm the benchmark name Memora, so the report says so.
- The report said the proxy needs no card; ADR 0036 says cards follow, and none exists in `docs/tasks/`, so AB-EVL-1 must add one.

**Refuted or dropped.**
- AB-EVL-4 (Inspect adapter): C1 to C5 and the plane are TypeScript in `packages/runner` and `packages/bench`; a Python Inspect task cannot run them without reimplementing them or shelling out to the runner, and its acceptance (per-item match with `make bench`) assumes that. It also creates a second result set. Dropped.
- AB-EVL-5 (promptfoo): duplicates `make test-invariants`, the conformance suite and the e2e layer; promptfoo's dependency tree is large (76 listed dependencies). Dropped.
- The "defect-code view after EvalMem" in AB-EVL-6 has no data to show (no Engram run produces defect codes), so it is removed; its dependency on AB-EVL-4 goes with it.

**Not re-verified.** Contents of vcrpy and LiteLLM record-mode and cache behaviour (taken from the notes' own sources), the three young proxies beyond API metadata, and the OTel spec text beyond the file listing (`docs/gen-ai/` has `retrieval.md`, `execute-tool.md`, `client-invoke-agent.md`; no memory span page). No em dash exists in the six notes; their frontmatter ids and code URLs are correct, so no note needed editing.

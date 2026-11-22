# Every command the team and CI use. Wraps pnpm and uv.
# Targets marked "stub" exit non-zero and name the card that implements them.

SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

PNPM ?= pnpm
UV ?= uv

.PHONY: help test test-invariants test-scale test-one test-e2e test-repro lint lint-docs api api-check ui bench run h1-table h1-figure l3-variance h3-lint-delta nli-scores nli-determinism h3-lint-nli fixtures fault-workspace gitleaks-rules thesis engram dogfood-report verify-spec perf-budget redteam

help: ## list targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | sed -E 's/:.*## /\t/' | expand -t 16

test: ## layers 1 to 5 and 7 (vitest) and research tests (pytest)
	$(PNPM) exec vitest run
	$(UV) run pytest research || [ $$? -eq 5 ]

test-invariants: ## the nine invariants against the real Plane, with counterexample and seed (issue #1), card E1.4's stateful model of the Plane, and the ninth, card E1.6's chain invariant, on SQLite and embedded Postgres
	ENGRAM_INVARIANTS=1 $(PNPM) --filter core exec vitest run test/property/invariants.test.ts test/property/stateful.test.ts test/property/chain.test.ts

test-scale: ## card RV1: H1's GateMem results at full size (26,616 rows, about 540 million characters) written and read back a line at a time; slow, writes about half a gigabyte to the temp folder
	ENGRAM_SCALE=1 $(PNPM) --filter runner exec vitest run test/scale.test.ts

test-one: ## one test file with its seed printed: make test-one T=<path>
	@[ -n "$(T)" ] || { echo "usage: make test-one T=<path>"; exit 2; }
	$(PNPM) exec vitest run "$(T)"

lint: ## biome, tsc, ruff, mypy; CI runs the same
	$(PNPM) exec biome check --error-on-warnings .
	$(PNPM) exec tsc -p tsconfig.json
	$(PNPM) exec tsc -p packages/ui/tsconfig.json
	$(UV) run ruff check research packages/bench/scripts
	$(UV) run ruff format --check research packages/bench/scripts
	$(UV) run mypy

lint-docs: ## log entries, em dashes, CLAUDE.md equals AGENTS.md; PR=<dir> checks a PR instead
ifdef PR
	@node scripts/check-pr.ts $(PR)
else
	node scripts/check-prose.ts
	node scripts/check-log.ts
endif

test-e2e: ui ## layer 6: engram doctor and a CLI smoke on SQLite and embedded Postgres, the MCP handshakes and the hook, and the inspector in Chromium on a fixture workspace; no Docker
	$(PNPM) exec vitest run --config test/e2e/vitest.config.ts

ui: ## build the inspector (Vite and React) into packages/ui/dist, which engram serve serves at /
	$(PNPM) --filter ui build

test-repro: ## layer 8: rerun every row of research/results/MANIFEST.md and fail on a sha256 that differs; may fetch pinned benchmark data into .engram/upstream
	$(UV) run python research/scripts/reproduce.py

api: ## regenerate sdk/schema, sdk/openapi.json, the clients in sdk/ts and packages/ui/src/api, research/engram_types, and the provider key names from pi-ai
	node packages/core/scripts/export-schema.ts sdk/schema
	node packages/server/scripts/api.ts
	rm -rf research/engram_types
	$(UV) run datamodel-codegen --input sdk/schema --input-file-type jsonschema 	  --output research/engram_types --output-model-type typing.TypedDict 	  --target-python-version 3.12 --use-standard-collections --use-union-operator 	  --use-title-as-name --disable-timestamp --formatters ruff-format
	find research/engram_types -name '*.py' -exec sed -i 's/\r$$//' {} +
	node packages/runner/scripts/provider-keys.ts
	$(PNPM) exec biome format --write $(PROVIDER_KEYS) > /dev/null

# The provider key names engram doctor checks, generated from pi-ai by the runner (the CLI never imports pi-ai).
PROVIDER_KEYS := packages/runner/src/model/provider-keys.json
GENERATED := sdk packages/ui/src/api research/engram_types $(PROVIDER_KEYS)

api-check: api ## fail if generated contracts differ from what is committed
	@git diff --exit-code -- $(GENERATED)
	@[ -z "$$(git status --porcelain -- $(GENERATED))" ] || { git status --short -- $(GENERATED); echo "api-check: untracked generated files"; exit 1; }

BENCH_OUT ?= .engram/bench/$(BENCH)

GATEMEM_DATA ?= .engram/upstream/gatemem/bench/data

bench: ## run one benchmark on its fixture subset with the scripted model, offline: make bench BENCH=gatemem, BENCH=longmemeval, BENCH=merit (MERIT's pinned harness through the cassette proxy and the plane; fetches the checkout and installs its Python 3.11 environment under .engram/ once) or BENCH=tau2 (tau2-bench at its pin in its own environment under .engram, fetched once, its agent and user-simulator calls replayed through the cassette proxy, card B11); DRY=1 (gatemem) counts the live run's calls on the full set, and its keys with MODEL=
ifeq ($(BENCH),gatemem)
ifeq ($(DRY),1)
	node packages/bench/scripts/dry-run-gatemem.ts --config fixtures/bench/gatemem/run-config.json --data "$(GATEMEM_DATA)" --fetch --out "$(BENCH_OUT)-dry" $(if $(MODEL),--model "$(MODEL)") $(if $(SEED),--seed "$(SEED)")
else
	ENGRAM_OFFLINE=1 node packages/bench/scripts/run-gatemem.ts --config fixtures/bench/gatemem/run-config.json --out "$(BENCH_OUT)"
endif
else ifeq ($(BENCH),longmemeval)
	ENGRAM_OFFLINE=1 node packages/runner/scripts/run.ts --config research/configs/b5-longmemeval-plane.json --out "$(BENCH_OUT)"
else ifeq ($(BENCH),merit)
	env -u ENGRAM_OFFLINE node packages/bench/scripts/run-merit.ts --prepare
	ENGRAM_OFFLINE=1 node packages/bench/scripts/run-merit.ts --config research/configs/b7-merit-fixture.json --out "$(BENCH_OUT)"
else ifeq ($(BENCH),tau2)
	node packages/bench/scripts/run-tau2.ts --setup
	ENGRAM_OFFLINE=1 node packages/bench/scripts/run-tau2.ts --config research/configs/b11-tau2-fixture.json --out "$(BENCH_OUT)"
else
	@echo "bench: BENCH=$(BENCH) has no runner; gatemem (card B1), longmemeval (card B5), merit (card B7) and tau2 (card B11) exist, the others land with cards B2 to B9"; exit 2
endif

RUN_OUT ?= .engram/runs/$(basename $(notdir $(CONFIG)))

run: ## replay a runner config as pi SDK sessions from its cassettes; a miss is an error: make run CONFIG=research/configs/rn1-gatemem-probe.json; MODEL=<provider/model> LIVE=1 runs it live into new cassettes under .engram/runs, REPLAY=1 replays those offline; COUNT=1 checks its data against the pin and counts its sessions, calling no model; each row is written as its session ends, and RESUME=1 continues the run already in the output folder (card RV1); a live run reruns a session a transient outage stopped, waiting up to about 12 minutes, before it stops and needs RESUME=1; a run stopped at its spend_ceiling_usd exits 3; SHARD=i/n runs the i-th of n blocks of its items into <out>-shard-<i>-of-<n>, the ceiling split n ways (the run can pass it by up to n sessions' cost), and MERGE=n (alone, or with MODEL= REPLAY=1 for a live run) joins the n shards into <out>, refusing a missing, unfinished, running or overlapping shard or another config (card RV6)
	@[ -n "$(CONFIG)" ] || { echo "usage: make run CONFIG=<runner config>"; exit 2; }
	node packages/runner/scripts/run.ts --config "$(CONFIG)" --out "$(RUN_OUT)$(if $(filter 1,$(LIVE) $(REPLAY)),-live)$(if $(filter 1,$(COUNT)),-count)" $(if $(filter 1,$(LIVE)),--live --model "$(MODEL)") $(if $(filter 1,$(REPLAY)),--replay --model "$(MODEL)") $(if $(filter 1,$(COUNT)),--count) $(if $(filter 1,$(RESUME)),--resume) $(if $(SHARD),--shard "$(SHARD)") $(if $(MERGE),--merge "$(MERGE)")

# The key from the blind UNREAD template's ids to H1's sessions; make h1-table writes it beside the template.
READINGS_KEY ?= .engram/runs/h1-unread-key.json
# GATE_BY_ACTION=1 gives the gate-by-action reading its own config, sessions and table; the main table's files are not touched.
H1_SUFFIX := $(if $(filter 1,$(GATE_BY_ACTION)),-gate-by-action)
H1_TABLE := h1-table$(H1_SUFFIX)

h1-table: ## after H1's two live runs (make run CONFIG=research/configs/h1-gatemem.json, then h1-mem-inv.json, MODEL=<provider/model> LIVE=1 or REPLAY=1): their rows as h1-sessions/2 in .engram/runs/h1-sessions.jsonl, MEM-INV-Bench's UNREAD replies for two readers, blind, one template each with its reader's pseudonymous id filled in, .engram/runs/h1-unread-reader1.json and h1-unread-reader2.json (opaque ids in an order the table config's seed shuffles; no condition, store, seed or item), with the key from id to session beside them in .engram/runs/h1-unread-key.json, which the readers are not given, then the H1 table in research/results/h1-table.json (primary GateMem set, secondary sets and refusal-leak sensitivity as research/configs/h1-table.json names them); the table also gives MGS per condition and MEM-INV-Bench's read_before_action; READINGS=<reader1's file>,<reader2's file>, one file per reader (each fills the template written for them, so neither sees the other's verdicts), joins the two back through that key (READINGS_KEY= names another), refuses a single reader's file, a reader other than reader1 and reader2, and a key entry with no reply in one reader's file, and writes no template; GATE_BY_ACTION=1 is the gate-by-action reading (a wrong action counts as a leak), which decides nothing (decides false, no decision block): sessions .engram/runs/h1-sessions-gate-by-action.jsonl, config research/configs/h1-table-gate-by-action.json, table research/results/h1-table-gate-by-action.json, the main table's files, template and key untouched
	node packages/runner/scripts/h1-sessions.ts --config research/configs/h1-gatemem.json --run .engram/runs/h1-gatemem-live --config research/configs/h1-mem-inv.json --run .engram/runs/h1-mem-inv-live --table-config research/configs/$(H1_TABLE).json $(if $(filter 1,$(GATE_BY_ACTION)),--gate-by-action) $(if $(READINGS),--readings "$(READINGS)" --readings-key "$(READINGS_KEY)",$(if $(H1_SUFFIX),,--unread-out .engram/runs/h1-unread.json)) --out .engram/runs/h1-sessions$(H1_SUFFIX).jsonl
	$(UV) run python research/scripts/h1_table.py --config research/configs/$(H1_TABLE).json --out research/results/$(H1_TABLE).json

h1-figure: ## after make h1-table: H1's figure from research/results/h1-table.json into research/results/h1-figure.svg (research/configs/h1-figure.json): per arm the violation rate of C2 to C5 with Wilson 95 percent intervals, and C4 minus C5 with its BCa interval, p-value and relative reduction; hand-written SVG, byte-stable
	$(UV) run python research/scripts/h1_figure.py --config research/configs/h1-figure.json --out research/results/h1-figure.svg

l3-variance: ## after the L3 pilot's live run (make run CONFIG=research/configs/l3-pilot.json MODEL=<provider/model> LIVE=1) and its model named in research/configs/l3-variance.json: the model-based lints' spread across seeds 1 to 3 (outcomes, item precision and recall, unit agreement), replayed offline from that run's cassettes, into research/results/l3-variance.json; FIXTURE=1 runs it on the scripted fixture run (research/configs/l3-variance-fixture.json) into .engram/l3-variance-fixture.json, not a result
	$(UV) run python research/scripts/l3_variance.py $(if $(filter 1,$(FIXTURE)),--config research/configs/l3-variance-fixture.json --out .engram/l3-variance-fixture.json,--config research/configs/l3-variance.json --out research/results/l3-variance.json)

h3-lint-delta: ## after H3's live model-lint run (make run CONFIG=research/configs/h3-lint-model.json MODEL=<provider/model> LIVE=1) and its model named in research/configs/h3-lint-delta.json: what card L3's model lints add to the deterministic floor per class, keyed and unkeyed apart, per seed and across seeds, replayed offline from that run's cassettes, into research/results/h3-lint-delta.json; FIXTURE=1 runs it on the scripted fixture run (research/configs/h3-lint-delta-fixture.json) into .engram/h3-lint-delta-fixture.json, not a result
	$(UV) run python research/scripts/h3_lint_delta.py $(if $(filter 1,$(FIXTURE)),--config research/configs/h3-lint-delta-fixture.json --out .engram/h3-lint-delta-fixture.json,--config research/configs/h3-lint-delta.json --out research/results/h3-lint-delta.json)

nli-scores: ## card L7: a lint config with an nli block (research/configs/l3-lint-nli-fixture.json, h3-lint-nli-fixture.json) run with its model calls replayed and each NLI score its cassettes miss computed by the pinned local model (fetched by sha256 into .engram/upstream when missing, network) and recorded; make run replays it with zero new scores
	@[ -n "$(CONFIG)" ] || { echo "usage: make nli-scores CONFIG=<lint config with an nli block>"; exit 2; }
	env -u ENGRAM_OFFLINE node packages/runner/scripts/run.ts --config "$(CONFIG)" --out "$(RUN_OUT)-nli" --record-nli

nli-determinism: ## card L7: the pinned NLI model scores 200 pairs of the fixture-size LongMemEval fault set in two processes, compared bit for bit and to a tolerance of 1e-6, into .engram/nli/determinism/summary.json (fetches the model when missing, network)
	env -u ENGRAM_OFFLINE node packages/runner/scripts/nli-determinism.ts

h3-lint-nli: ## card L7, arm P3 (proposed, not registered): the NLI tier beside the model tier on the fixture, replayed offline from committed cassettes with zero new calls and scores: thresholds checked against card L3's contradiction fixtures, model calls saved, every contradiction label's band, recall and precision per class, into research/results/h3-lint-nli.json; an engineering check, not a thesis result
	$(UV) run python research/scripts/h3_lint_nli.py --config research/configs/h3-lint-nli.json --out research/results/h3-lint-nli.json

PERF_BUDGET := $(UV) run python research/scripts/perf_budget.py --config research/configs/perf-budget.json

redteam: ## card X14: the red-team harness, model-free and offline once the data is fetched: OWASP's AMSB scenarios (fixtures/amsb), the deepset and Lakera payload sets (fetched at their pins in packages/bench/PINS.md into .engram/upstream, data only) and card X14's controls, planted through Plane.write (write route) and adopted at read (read route) as each source kind, under the store directly, medium and its guard variants (research/configs/redteam.json), then research/scripts/redteam.py: attack survival and benign false holds with Wilson intervals, guard on against off with the paired BCa interval, into research/results/h1-redteam.json (an engineering check: proposal P1 is not registered)
	env -u ENGRAM_OFFLINE node packages/bench/scripts/redteam.ts --config research/configs/redteam.json --fetch-only
	ENGRAM_OFFLINE=1 $(UV) run python research/scripts/redteam.py --config research/configs/redteam.json --out research/results/h1-redteam.json

perf-budget: ## card X15: research/results/h2-perf-budget.json from the committed samples, research/results/h2-perf-budget-samples.jsonl (what make test-repro regenerates; no suite run); MEASURE=1 first reruns the plane-overhead suite (packages/core/bench/plane-overhead.ts) into those samples, about 15 to 25 minutes, replacing them; CHECK=1 is the rerun check instead, about 15 to 25 minutes: the suite into a temporary file (FRESH=<file> keeps it, or reads it when it exists), passing when every median lies within the config's per-cell band of the committed one, each op's geometric mean of median ratios at most its aggregate band (one-sided: a faster run passes), and every query count and starting log size equal; nothing committed is written
ifeq ($(CHECK),1)
	$(PERF_BUDGET) --rerun $(if $(FRESH),--fresh "$(FRESH)")
else
ifeq ($(MEASURE),1)
	$(PERF_BUDGET) --measure
endif
	$(PERF_BUDGET) --out research/results/h2-perf-budget.json
endif

# Runner configs whose cassettes are fixtures, recorded from their scripted model by `make fixtures`.
RUNNER_FIXTURES := rn1-gatemem-probe
RUNNER_FIXTURES += b3-gatemem-plane
RUNNER_FIXTURES += b4-mem-inv-probe
RUNNER_FIXTURES += x1-h1-gatemem
RUNNER_FIXTURES += x1-h1-gatemem-rag
RUNNER_FIXTURES += x1-h1-mem-inv
RUNNER_FIXTURES += b5-longmemeval-plane
RUNNER_FIXTURES += l3-lint-fixture
RUNNER_FIXTURES += h3-lint-model-fixture
RUNNER_FIXTURES += d2-induce-fixture
# After D2: card D3 replays the candidates D2's cassette induces.
RUNNER_FIXTURES += d3-validate-fixture

# MEM-INV-Bench at its pinned commit (card B4); the vendoring clones it here when missing.
MEM_INV_UPSTREAM ?= .engram/upstream/mem-inv-bench
# LongMemEval at its pinned commit and dataset revision (card B5); the vendoring fetches what is missing.
LONGMEMEVAL_UPSTREAM ?= .engram/upstream/longmemeval

fixtures: ## regenerate golden files and scripted cassettes; refuses without MSG=<reason>, which goes in the commit message
	@[ -n "$(MSG)" ] || { echo "fixtures: refusing without MSG=<reason>"; exit 2; }
	$(UV) run python research/scripts/consolidate_log.py --root fixtures/log/repo --out fixtures/log/expected
	rm -rf fixtures/faults && node packages/core/scripts/faults.ts write fixtures/faults
	rm -rf fixtures/sessions/d1 && node packages/runner/scripts/session-fixtures.ts --seed 1 --out fixtures/sessions/d1
	ENGRAM_UPDATE_FIXTURES=1 $(PNPM) --filter pi-extension exec vitest run test/interception.test.ts test/retention.test.ts
	env -u ENGRAM_OFFLINE node packages/bench/scripts/run-gatemem.ts --config fixtures/bench/gatemem/run-config.json --out .engram/bench/gatemem-record --record
	env -u ENGRAM_OFFLINE ENGRAM_UPDATE_FIXTURES=1 node packages/bench/scripts/run-tau2.ts --setup
	env -u ENGRAM_OFFLINE ENGRAM_UPDATE_FIXTURES=1 node packages/bench/scripts/run-tau2.ts --config research/configs/b11-tau2-fixture.json --out .engram/bench/tau2-record --record
	$(UV) run python -I packages/bench/scripts/vendor-mem-inv-bench.py --upstream "$(MEM_INV_UPSTREAM)" --fetch --out fixtures/bench/mem-inv-bench
	$(UV) run python -I packages/bench/scripts/vendor-amsb.py --upstream .engram/upstream/amsb --fetch --out fixtures/amsb
	$(UV) run python -I packages/bench/scripts/upstream-mem-inv-golden.py --upstream "$(MEM_INV_UPSTREAM)" --fixtures fixtures/bench/mem-inv-bench --out fixtures/bench/mem-inv-bench/upstream-golden.json
	env -u ENGRAM_OFFLINE node packages/bench/scripts/vendor-longmemeval.ts --upstream "$(LONGMEMEVAL_UPSTREAM)" --fetch --out fixtures/bench/longmemeval
	node packages/bench/scripts/fault-set.ts --data fixtures/bench/longmemeval/questions.jsonl --config research/configs/h3-fault-set.json --out fixtures/fault-sets/longmemeval
	node packages/runner/scripts/fault-set-script.ts --config research/configs/h3-lint-model-fixture.json --out fixtures/lint/h3-lint-model-script.json
	ENGRAM_UPDATE_FIXTURES=1 env -u ENGRAM_OFFLINE node packages/bench/scripts/run-merit.ts --config research/configs/b7-merit-fixture.json --out .engram/bench/merit-record --record
	for name in $(RUNNER_FIXTURES); do \
	  rm -rf "fixtures/cassettes/$$name"; \
	  env -u ENGRAM_OFFLINE node packages/runner/scripts/run.ts --config "research/configs/$$name.json" --out ".engram/runs/$$name" --record; \
	done
	@git status --short fixtures
	@echo "fixtures regenerated; commit them on their own with the reason: $(MSG)"

ROOT ?= .
OUT ?= $(ROOT)/research/thesis/drafts

thesis: ## consolidate docs/log into research/thesis/drafts; ROOT= and OUT= to run on a fixture log
	$(UV) run python research/scripts/consolidate_log.py --root "$(ROOT)" --out "$(OUT)"

fault-workspace: ## a SQLite log and policy from one fault fixture, to lint with the CLI: make fault-workspace FAULT=orphan.flag
	@[ -n "$(FAULT)" ] || { echo "fault-workspace: give FAULT=<name> from fixtures/faults"; exit 2; }
	rm -rf ".engram/faults/$(FAULT)"
	node packages/core/scripts/faults.ts workspace "fixtures/faults/$(FAULT).json" ".engram/faults/$(FAULT)"

gitleaks-rules: ## card E2.9: regenerate packages/core/src/vendor/gitleaks-rules.ts from gitleaks' rules at the pinned commit (fetched into .engram/upstream when missing); about five minutes
	node packages/core/scripts/gitleaks-rules.ts

dogfood-report: ## the twin dogfood's violation report over your own log, counts only: make dogfood-report ARGS="--as person:<you>"
	@node packages/core/scripts/dogfood-report.ts $(ARGS)

engram: ## run the engram CLI: make engram ARGS="read --root <folder> --owner <id>"
	@node packages/cli/src/main.ts $(ARGS)

# Card E1.5: the Quint model of the commit and erasure protocol (specs/).
# Quint runs through npx at an exact version, not as a workspace dependency,
# and fetches its Rust simulator and Apalache into ~/.quint on first use.
QUINT_VERSION := 0.33.1
APALACHE_VERSION := 0.62.4
QUINT ?= npx --yes @informalsystems/quint@$(QUINT_VERSION)
SPEC_SEEDS ?= 1 2 3
SPEC_SAMPLES ?= 5000
SPEC_STEPS ?= 60
SPEC_DEPTH ?= 4
SPEC_OUT := .engram/verify-spec
SPEC_WITNESSES := sawConflict sawWithdrawal sawWriterAcrossErasure sawSwept sawPutBack sawAdoptErased sawWriteErased sawErasing sawReopen sawAdoptionOverUser sawAsHeldAboveImport
# What the broken variant must violate: the erasure properties first;
# noStaleAppend restates the removed check, so it is an extra. Apalache's
# depth cannot reach an erasure (at least 6 steps), so it is held to the two
# it can refute within SPEC_DEPTH.
SPEC_BROKEN_SIM := erasureHolds noWriteWhileErasing noStaleAppend
SPEC_BROKEN_BMC := noWriteWhileErasing noStaleAppend

verify-spec: ## card E1.5: typecheck and test specs/commit.qnt, simulate the good model, refute the broken one, and (with a JVM) bounded-check both with Apalache; outside make test
	@mkdir -p $(SPEC_OUT)
	$(QUINT) typecheck specs/commit.qnt
	$(QUINT) test specs/commit.qnt --main=good
	$(QUINT) test specs/commit.qnt --main=broken
	$(QUINT) test specs/commit.qnt --main=knownGapThreeOffboardings
	@for seed in $(SPEC_SEEDS); do \
	  echo "simulation of the good model: seed $$seed, $(SPEC_SAMPLES) traces of $(SPEC_STEPS) steps"; \
	  $(QUINT) run specs/commit.qnt --main=good --invariant=safety --max-samples=$(SPEC_SAMPLES) \
	    --max-steps=$(SPEC_STEPS) --seed=$$seed --n-threads=4 --verbosity=1 --witnesses $(SPEC_WITNESSES) \
	    || { echo "verify-spec: the good model violates a property (seed $$seed)"; exit 1; }; \
	done
	@for inv in $(SPEC_BROKEN_SIM); do \
	  out=$(SPEC_OUT)/broken-simulation-$$inv; rm -f $$out.itf.json $$out.txt; \
	  echo "simulation of the broken model: the checker must refute $$inv"; \
	  if $(QUINT) run specs/commit.qnt --main=broken --invariant=$$inv --max-samples=$(SPEC_SAMPLES) \
	      --max-steps=$(SPEC_STEPS) --seed=1 --n-threads=4 --out-itf=$$out.itf.json > $$out.txt 2>&1; then \
	    echo "verify-spec: the broken model was not refuted on $$inv"; exit 1; fi; \
	  grep -q '"status":"violation"' $$out.itf.json 2>/dev/null \
	    || { cat $$out.txt; echo "verify-spec: the broken run on $$inv failed without a counterexample"; exit 1; }; \
	  echo "refuted; the trace is in $$out.itf.json"; \
	done
	@if ! command -v java > /dev/null; then \
	  echo "verify-spec: no JVM on the path, so no Apalache: the checking above is randomized simulation only"; exit 0; fi; \
	cd $(SPEC_OUT) && \
	echo "Apalache, good model: every interleaving up to $(SPEC_DEPTH) steps" && \
	$(QUINT) verify ../../specs/commit.qnt --main=good --invariant=safety --max-steps=$(SPEC_DEPTH) \
	  --apalache-version=$(APALACHE_VERSION) --verbosity=1 \
	  || { echo "verify-spec: Apalache found a violation in the good model"; exit 1; }; \
	for inv in $(SPEC_BROKEN_BMC); do \
	  out=broken-apalache-$$inv; rm -f $$out.itf.json $$out.txt; \
	  echo "Apalache, broken model: $$inv must fail within $(SPEC_DEPTH) steps"; \
	  if $(QUINT) verify ../../specs/commit.qnt --main=broken --invariant=$$inv --max-steps=$(SPEC_DEPTH) \
	      --apalache-version=$(APALACHE_VERSION) --out-itf=$$out.itf.json > $$out.txt 2>&1; then \
	    echo "verify-spec: Apalache did not refute the broken model on $$inv"; exit 1; fi; \
	  grep -q "found a counterexample" $$out.txt \
	    || { cat $$out.txt; echo "verify-spec: the Apalache run on $$inv failed without a counterexample"; exit 1; }; \
	  echo "refuted; the trace is in $(SPEC_OUT)/$$out.itf.json"; \
	done

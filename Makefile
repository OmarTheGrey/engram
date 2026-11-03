# Every command the team and CI use. Wraps pnpm and uv.
# Targets marked "stub" exit non-zero and name the card that implements them.

SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

PNPM ?= pnpm
UV ?= uv

.PHONY: help test test-invariants test-one test-e2e test-repro lint lint-docs api api-check ui bench run h1-table fixtures thesis engram

help: ## list targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | sed -E 's/:.*## /\t/' | expand -t 16

test: ## layers 1 to 5 and 7 (vitest) and research tests (pytest)
	$(PNPM) exec vitest run
	$(UV) run pytest research || [ $$? -eq 5 ]

test-invariants: ## the five invariants against the real Plane, with counterexample and seed (issue #1)
	ENGRAM_INVARIANTS=1 $(PNPM) --filter core exec vitest run test/property/invariants.test.ts

test-one: ## one test file with its seed printed: make test-one T=<path>
	@[ -n "$(T)" ] || { echo "usage: make test-one T=<path>"; exit 2; }
	$(PNPM) exec vitest run "$(T)"

lint: ## biome, tsc, ruff, mypy; CI runs the same
	$(PNPM) exec biome check --error-on-warnings .
	$(PNPM) exec tsc -p tsconfig.json
	$(PNPM) exec tsc -p packages/ui/tsconfig.json
	$(UV) run ruff check research
	$(UV) run ruff format --check research
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

bench: ## run one benchmark on its fixture subset with the scripted model, offline: make bench BENCH=gatemem; DRY=1 counts the live run's calls on the full set, and its keys with MODEL=
ifeq ($(BENCH),gatemem)
ifeq ($(DRY),1)
	node packages/bench/scripts/dry-run-gatemem.ts --config fixtures/bench/gatemem/run-config.json --data "$(GATEMEM_DATA)" --fetch --out "$(BENCH_OUT)-dry" $(if $(MODEL),--model "$(MODEL)") $(if $(SEED),--seed "$(SEED)")
else
	ENGRAM_OFFLINE=1 node packages/bench/scripts/run-gatemem.ts --config fixtures/bench/gatemem/run-config.json --out "$(BENCH_OUT)"
endif
else
	@echo "bench: BENCH=$(BENCH) has no runner; only gatemem exists (card B1), the others land with cards B2 to B9"; exit 2
endif

RUN_OUT ?= .engram/runs/$(basename $(notdir $(CONFIG)))

run: ## replay a runner config as pi SDK sessions from its cassettes; a miss is an error: make run CONFIG=research/configs/rn1-gatemem-probe.json; MODEL=<provider/model> LIVE=1 runs it live into new cassettes under .engram/runs, REPLAY=1 replays those offline; COUNT=1 checks its data against the pin and counts its sessions, calling no model
	@[ -n "$(CONFIG)" ] || { echo "usage: make run CONFIG=<runner config>"; exit 2; }
	node packages/runner/scripts/run.ts --config "$(CONFIG)" --out "$(RUN_OUT)$(if $(filter 1,$(LIVE) $(REPLAY)),-live)$(if $(filter 1,$(COUNT)),-count)" $(if $(filter 1,$(LIVE)),--live --model "$(MODEL)") $(if $(filter 1,$(REPLAY)),--replay --model "$(MODEL)") $(if $(filter 1,$(COUNT)),--count)

# The key from the blind UNREAD template's ids to H1's sessions; make h1-table writes it beside the template.
READINGS_KEY ?= .engram/runs/h1-unread-key.json
# GATE_BY_ACTION=1 gives the gate-by-action reading its own config, sessions and table; the main table's files are not touched.
H1_SUFFIX := $(if $(filter 1,$(GATE_BY_ACTION)),-gate-by-action)
H1_TABLE := h1-table$(H1_SUFFIX)

h1-table: ## after H1's two live runs (make run CONFIG=research/configs/h1-gatemem.json, then h1-mem-inv.json, MODEL=<provider/model> LIVE=1 or REPLAY=1): their rows as h1-sessions/2 in .engram/runs/h1-sessions.jsonl, MEM-INV-Bench's UNREAD replies in .engram/runs/h1-unread.json for two readers, blind (opaque ids in an order the table config's seed shuffles; no condition, store, seed or item), with the key from id to session beside it in .engram/runs/h1-unread-key.json, which the readers are not given, then the H1 table in research/results/h1-table.json (primary GateMem set, secondary sets and refusal-leak sensitivity as research/configs/h1-table.json names them); the table also gives MGS per condition and MEM-INV-Bench's read_before_action; READINGS=<filled copy of the template> joins their readings back through that key (READINGS_KEY= names another) and writes no template; GATE_BY_ACTION=1 is the gate-by-action reading (a wrong action counts as a leak), which decides nothing (decides false, no decision block): sessions .engram/runs/h1-sessions-gate-by-action.jsonl, config research/configs/h1-table-gate-by-action.json, table research/results/h1-table-gate-by-action.json, the main table's files, template and key untouched
	node packages/runner/scripts/h1-sessions.ts --config research/configs/h1-gatemem.json --run .engram/runs/h1-gatemem-live --config research/configs/h1-mem-inv.json --run .engram/runs/h1-mem-inv-live --table-config research/configs/$(H1_TABLE).json $(if $(filter 1,$(GATE_BY_ACTION)),--gate-by-action) $(if $(READINGS),--readings "$(READINGS)" --readings-key "$(READINGS_KEY)",$(if $(H1_SUFFIX),,--unread-out .engram/runs/h1-unread.json)) --out .engram/runs/h1-sessions$(H1_SUFFIX).jsonl
	$(UV) run python research/scripts/h1_table.py --config research/configs/$(H1_TABLE).json --out research/results/$(H1_TABLE).json

# Runner configs whose cassettes are fixtures, recorded from their scripted model by `make fixtures`.
RUNNER_FIXTURES := rn1-gatemem-probe
RUNNER_FIXTURES += b3-gatemem-plane
RUNNER_FIXTURES += b4-mem-inv-probe
RUNNER_FIXTURES += x1-h1-gatemem
RUNNER_FIXTURES += x1-h1-gatemem-rag
RUNNER_FIXTURES += x1-h1-mem-inv

# MEM-INV-Bench at its pinned commit (card B4); the vendoring clones it here when missing.
MEM_INV_UPSTREAM ?= .engram/upstream/mem-inv-bench

fixtures: ## regenerate golden files and scripted cassettes; refuses without MSG=<reason>, which goes in the commit message
	@[ -n "$(MSG)" ] || { echo "fixtures: refusing without MSG=<reason>"; exit 2; }
	$(UV) run python research/scripts/consolidate_log.py --root fixtures/log/repo --out fixtures/log/expected
	ENGRAM_UPDATE_FIXTURES=1 $(PNPM) --filter pi-extension exec vitest run test/interception.test.ts test/retention.test.ts
	env -u ENGRAM_OFFLINE node packages/bench/scripts/run-gatemem.ts --config fixtures/bench/gatemem/run-config.json --out .engram/bench/gatemem-record --record
	$(UV) run python -I packages/bench/scripts/vendor-mem-inv-bench.py --upstream "$(MEM_INV_UPSTREAM)" --fetch --out fixtures/bench/mem-inv-bench
	$(UV) run python -I packages/bench/scripts/upstream-mem-inv-golden.py --upstream "$(MEM_INV_UPSTREAM)" --fixtures fixtures/bench/mem-inv-bench --out fixtures/bench/mem-inv-bench/upstream-golden.json
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

engram: ## run the engram CLI: make engram ARGS="read --root <folder> --owner <id>"
	@node packages/cli/src/main.ts $(ARGS)

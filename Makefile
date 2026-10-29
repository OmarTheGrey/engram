# Every command the team and CI use. Wraps pnpm and uv.
# Targets marked "stub" exit non-zero and name the card that implements them.

SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

PNPM ?= pnpm
UV ?= uv

.PHONY: help test test-invariants test-one test-e2e test-repro lint lint-docs api api-check bench run fixtures thesis engram

help: ## list targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | sed -E 's/:.*## /\t/' | expand -t 16

test: ## layers 1 to 5 and 7 (vitest) and research tests (pytest)
	$(PNPM) exec vitest run
	$(UV) run pytest research || [ $$? -eq 5 ]

test-invariants: ## the four invariants against the real Plane, with counterexample and seed (issue #1)
	ENGRAM_INVARIANTS=1 $(PNPM) --filter core exec vitest run test/property/invariants.test.ts

test-one: ## one test file with its seed printed: make test-one T=<path>
	@[ -n "$(T)" ] || { echo "usage: make test-one T=<path>"; exit 2; }
	$(PNPM) exec vitest run "$(T)"

lint: ## biome, tsc, ruff, mypy; CI runs the same
	$(PNPM) exec biome check --error-on-warnings .
	$(PNPM) exec tsc -p tsconfig.json
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

test-e2e: ## stub: layer 6, compose, doctor, CLI smoke, MCP handshakes
	@echo "test-e2e: not implemented yet (layer 6 lands with the surfaces cards)"; exit 2

test-repro: ## stub: layer 8, every research script regenerates its result
	@echo "test-repro: not implemented yet (layer 8 lands with the first research script)"; exit 2

api: ## regenerate sdk/schema (JSON Schema) and research/engram_types (Python) from packages/core/src/schema.ts
	node packages/core/scripts/export-schema.ts sdk/schema
	rm -rf research/engram_types
	$(UV) run datamodel-codegen --input sdk/schema --input-file-type jsonschema 	  --output research/engram_types --output-model-type typing.TypedDict 	  --target-python-version 3.12 --use-standard-collections --use-union-operator 	  --use-title-as-name --disable-timestamp --formatters ruff-format
	find research/engram_types -name '*.py' -exec sed -i 's/\r$$//' {} +

api-check: api ## fail if generated contracts differ from what is committed
	@git diff --exit-code -- sdk research/engram_types
	@[ -z "$$(git status --porcelain -- sdk research/engram_types)" ] || { git status --short -- sdk research/engram_types; echo "api-check: untracked generated files"; exit 1; }

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

run: ## replay a runner config as pi SDK sessions from its cassettes; a miss is an error: make run CONFIG=research/configs/rn1-gatemem-probe.json
	@[ -n "$(CONFIG)" ] || { echo "usage: make run CONFIG=<runner config>"; exit 2; }
	node packages/runner/scripts/run.ts --config "$(CONFIG)" --out "$(RUN_OUT)"

# Runner configs whose cassettes are fixtures, recorded from their scripted model by `make fixtures`.
RUNNER_FIXTURES := rn1-gatemem-probe

fixtures: ## regenerate golden files and scripted cassettes; refuses without MSG=<reason>, which goes in the commit message
	@[ -n "$(MSG)" ] || { echo "fixtures: refusing without MSG=<reason>"; exit 2; }
	$(UV) run python research/scripts/consolidate_log.py --root fixtures/log/repo --out fixtures/log/expected
	ENGRAM_UPDATE_FIXTURES=1 $(PNPM) --filter pi-extension exec vitest run test/interception.test.ts
	env -u ENGRAM_OFFLINE node packages/bench/scripts/run-gatemem.ts --config fixtures/bench/gatemem/run-config.json --out .engram/bench/gatemem-record --record
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

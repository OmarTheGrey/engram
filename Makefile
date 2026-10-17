# Every command the team and CI use. Wraps pnpm and uv.
# Targets marked "stub" exit non-zero and name the card that implements them.

SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

PNPM ?= pnpm
UV ?= uv

.PHONY: help test test-one test-e2e test-repro lint lint-docs api bench fixtures thesis

help: ## list targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | sed -E 's/:.*## /\t/' | expand -t 16

test: ## layers 1 to 5 and 7 (vitest) and research tests (pytest)
	$(PNPM) exec vitest run
	$(UV) run pytest research || [ $$? -eq 5 ]

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

api: ## stub: regenerate OpenAPI and the clients (S0.7)
	@echo "api: not implemented yet (step-0 task S0.7)"; exit 2

bench: ## stub: run one benchmark on its fixture subset: make bench BENCH=<name>
	@echo "bench: not implemented yet (benchmark cards B1 to B9)"; exit 2

fixtures: ## regenerate golden files; refuses without MSG=<reason>, which goes in the commit message
	@[ -n "$(MSG)" ] || { echo "fixtures: refusing without MSG=<reason>"; exit 2; }
	$(UV) run python research/scripts/consolidate_log.py --root fixtures/log/repo --out fixtures/log/expected
	@git status --short fixtures
	@echo "fixtures regenerated; commit them on their own with the reason: $(MSG)"

ROOT ?= .
OUT ?= $(ROOT)/research/thesis/drafts

thesis: ## consolidate docs/log into research/thesis/drafts; ROOT= and OUT= to run on a fixture log
	$(UV) run python research/scripts/consolidate_log.py --root "$(ROOT)" --out "$(OUT)"

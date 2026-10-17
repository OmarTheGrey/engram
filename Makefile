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

lint-docs: ## log entry frontmatter, em dashes in prose, CLAUDE.md equals AGENTS.md
	node scripts/check-prose.ts
	node scripts/check-log.ts

test-e2e: ## stub: layer 6, compose, doctor, CLI smoke, MCP handshakes
	@echo "test-e2e: not implemented yet (layer 6 lands with the surfaces cards)"; exit 2

test-repro: ## stub: layer 8, every research script regenerates its result
	@echo "test-repro: not implemented yet (layer 8 lands with the first research script)"; exit 2

api: ## stub: regenerate OpenAPI and the clients (S0.7)
	@echo "api: not implemented yet (step-0 task S0.7)"; exit 2

bench: ## stub: run one benchmark on its fixture subset: make bench BENCH=<name>
	@echo "bench: not implemented yet (benchmark cards B1 to B9)"; exit 2

fixtures: ## stub: regenerate golden files; refuses without MSG
	@[ -n "$(MSG)" ] || { echo "fixtures: refusing without MSG=<reason>"; exit 2; }
	@echo "fixtures: no generators registered yet"; exit 2

thesis: ## stub: consolidate docs/log into research/thesis/drafts (S0.4)
	@echo "thesis: not implemented yet (step-0 task S0.4)"; exit 2

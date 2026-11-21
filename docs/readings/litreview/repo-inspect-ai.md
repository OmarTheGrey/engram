---
id: repo-inspect-ai
title: Inspect AI, the UK AI Security Institute's evaluation framework
authors: UK AI Security Institute (UKGovernmentBEIS)
venue: open-source repository, v0.3.291 (2026-11-17)
year: 2026
tier: new
topics: [evaluation, harness, caching, tooling]
engram: [plane, H1, H2]
code: https://github.com/UKGovernmentBEIS/inspect_ai
sources_read: [https://github.com/UKGovernmentBEIS/inspect_ai, https://inspect.aisi.org.uk/, https://inspect.aisi.org.uk/caching.html, https://inspect.aisi.org.uk/extensions-model-api.html, https://inspect.aisi.org.uk/log-viewer.html]
---

## Claim
Inspect is the widely used open evaluation framework for model and agent evals: tasks (dataset, solver, scorer), a pluggable model layer, a call cache, and a log viewer that can be bundled as a static site.

## Method
A `@task` function returns `Task(dataset, solver, scorer)`. Providers are `ModelAPI` subclasses registered with `@modelapi` and discovered through the `inspect_ai` entry point group. `generate()` may return a `ModelCall` so the raw request and response land in the transcript. `cache=True` stores responses keyed on model name and base URL, constructor arguments, message history, epoch, generate config, tools and tool_choice, with a one-week default expiry and `inspect cache list|clear|prune`. `inspect view bundle` writes a self-contained viewer directory for a static host or a HuggingFace Space.

## Key numbers
- MIT licence, 3,302 stars, last push 2026-11-20 (GitHub API, checked 2026-11-21).
- Latest release 0.3.291, 2026-11-17 (GitHub releases API).
- Sister repository inspect_evals: MIT, 750 stars, pushed 2026-11-20.

## What Engram borrows
A thin Python package that registers Engram's conditions (C1 to C5) as Inspect tasks, and an Inspect `ModelAPI` that points at the ADR 0036 cassette proxy so Inspect-hosted tasks obey rules 6 and 7. The static viewer bundle is a ready log browser and leaderboard host for the thesis.

## What Engram does differently
Inspect's cache key has no seed, item or condition field and entries expire; Engram's cassettes are committed, never expire and make a miss an error. Inspect would be a front end over the proxy, not a replacement for `@engram/runner`.

## Risk to our claims
A second way to run the benchmarks can create a second set of numbers. Mitigation: the adapter only replays through the same cassettes and never records, and results still come from `research/scripts/`.

## Open question
Can Inspect's logs be converted to Engram's results.jsonl rows byte-stably, so the viewer shows the committed results and not its own?

## Notes
Python only. Whether a generic OpenAI-compatible provider name exists was not confirmed from the pages read.

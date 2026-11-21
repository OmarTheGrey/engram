---
id: repo-promptfoo
title: promptfoo, a TypeScript eval and red-team runner
authors: promptfoo contributors
venue: open-source repository
year: 2026
tier: new
topics: [evaluation, tooling, ci]
engram: [plane, H1]
code: https://github.com/promptfoo/promptfoo
sources_read: [https://github.com/promptfoo/promptfoo, https://www.promptfoo.dev/docs/providers/custom-api/]
---

## Claim
promptfoo runs declarative eval suites with custom providers written in JS, TS or Python, a result cache and a web viewer.

## Method
A provider implements `id()` and `callApi(prompt, context, options)` and returns `output`, `error`, `tokenUsage`, `cost`, `cached`, `metadata`. Suites are YAML with assertions. A cache API exists (`promptfoo.cache.getCache()`, `fetchWithCache`).

## Key numbers
- MIT, 27,510 stars, pushed 2026-11-21 (GitHub API).
- Cache key, disable flag and seed behaviour: none stated in the page read.

## What Engram borrows
A TypeScript custom provider calling the generated `@engram/sdk` client, so policy suites (write refusals, scope leaks) run in CI as YAML assertions.

## What Engram does differently
Its cache is not a committed cassette set, and I did not confirm a miss-is-error mode.

## Risk to our claims
Two eval stacks to maintain. Keep promptfoo to product regression and Inspect to benchmarks.

## Open question
Does promptfoo's cache honour a seed, or would the cassette proxy sit beneath it?

## Notes
Second choice to Inspect for this project.

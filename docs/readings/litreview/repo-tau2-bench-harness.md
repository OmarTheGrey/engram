---
id: repo-tau2-bench-harness
title: tau2-bench as a harness: versions, CLI, and how its model calls can be routed
authors: Sierra Research
venue: repository, v1.0.1 (2026-07-22) and v2.0.0 (2026-10-20)
year: 2026
tier: new
topics: [benchmark, evaluation, procedural]
engram: [distill, H5]
code: https://github.com/sierra-research/tau2-bench (MIT, 2,495 stars, pushed 2026-11-21 per gh api; Python 3.12 or 3.13, uv)
sources_read: [README.md, RELEASE_NOTES.md, docs/cli-reference.md (grep only), src/tau2/utils/llm_utils.py at v1.0.1 (the generate function), all via gh api]
---

## Claim
tau2 is driven from a CLI and every model call goes through one function that forwards extra arguments to LiteLLM, so a local proxy should be a configuration change, not a fork.

## Method
`tau2 run --domain <d> --agent-llm <m> --user-llm <m> --agent-llm-args <json> --user-llm-args <json> --num-trials --task-ids --task-split-name --seed --save-to --max-concurrency` (cli-reference). In `llm_utils.generate` at v1.0.1, `litellm.completion(model, messages, tools, tool_choice, **kwargs)` receives the `llm_args`. So `{"api_base": "http://127.0.0.1:<port>/v1"}` with an `openai/` model prefix should send traffic to a local OpenAI-compatible endpoint. This is inferred from LiteLLM behaviour and was not tested. The module also enables an optional LiteLLM cache (local or Redis) by flag, which must stay off so the plane's cassettes are the only cache. The default seed is 300 (cli-reference); whether it reaches the provider was not checked.

## Key numbers
- v2.0.0 scores are not comparable with 1.x: user simulator gpt-4.1 became gpt-5.5, communication checks became an LLM judge, 50 retail and 50 telecom tasks were replaced (README).
- `text-v1`: 3 domains, 50 frozen tasks each, 900 calls at one trial (README).
- v1.0.1 is the tag the pre-registration pins (docs/research/preregistration.md).

## What Engram borrows
ADR 0036's proxy plus `--agent-llm-args` and `--user-llm-args` make tau2 replayable. Run at v1.0.1 under uv, one process per (condition, seed), memory injected by a custom agent registered through `registry.register_agent_factory` that calls Engram's HTTP or MCP surface.

## What Engram does differently
tau2 trials are neither cached nor replayable. Engram's proxy supplies both.

## Risk to our claims
Agent and user-simulator calls have the same shape, so the cache key needs a role field. Under `--max-concurrency` call order changes, so keys must be the prompt hash, never call order. Prompts that embed timestamps would miss the cache.

## Open question
Does v1.0.1 still build under its uv lock on Windows and Linux CI? Python 3.12 or 3.13 is a second runtime beside Node 24.

## Notes
The existing note 2506.07982 covers the paper. This one covers only driving the code.

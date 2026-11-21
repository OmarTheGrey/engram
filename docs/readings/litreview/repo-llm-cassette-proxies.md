---
id: repo-llm-cassette-proxies
title: Record and replay tooling for LLM calls (vcrpy, LiteLLM cache, 2026 cassette proxies)
authors: various
venue: open-source repositories
year: 2026
tier: new
topics: [evaluation, caching, reproducibility, tooling]
engram: [plane, H1]
code: https://github.com/kevin1024/vcrpy
sources_read: [https://docs.litellm.ai/docs/proxy/caching, GitHub API metadata for kevin1024/vcrpy, BerriAI/litellm, Zecrari/retake, tapelock/tapelock, gangjig/llm-cassette, mitmproxy/mitmproxy]
---

## Claim
No mature OpenAI-compatible cassette proxy exists to vendor; the 2026 ones have 0 to 2 stars. The practical absorption is vcrpy's ideas and LiteLLM's own hooks, with the proxy itself on `node:http`.

## Method
LiteLLM's proxy caches in memory, disk, Redis, S3 and GCS, keyed on a hash of the whole request. The page read states no replay-only mode and says nothing on seed. vcrpy records HTTP at the client level; its `record_mode="none"` makes a miss an error (from my knowledge of vcrpy, not re-read). retake (MIT), tapelock (Apache-2.0, Go) and llm-cassette (MIT) are proxies created Sep to Oct 2026 and not audited beyond API metadata.

## Key numbers
- vcrpy: MIT, 3,024 stars, 9.4.2 on PyPI, pushed 2026-11-17.
- LiteLLM: MIT outside `litellm/enterprise/` (LICENSE read), 63,642 stars, pushed 2026-11-21.
- mitmproxy: MIT, 47,117 stars.
- retake 0 stars, tapelock 2, llm-cassette 1 (GitHub API, 2026-11-21).

## What Engram borrows
vcrpy's record modes and matcher design; tapelock's rule that replay never falls back upstream; a cache-key response header for hit evidence.

## What Engram does differently
The key is ADR 0017's and entries land in the same cassette files as the runner, so one cache serves both stacks.

## Risk to our claims
Python harnesses may use streaming, tool calls or embeddings; the proxy must fail loudly on any route it does not support.

## Open question
Do MERIT, tau2 and MemoryAgentBench set a seed on each call, or must the proxy inject it from config?

## Notes
Do not depend on any 2026 proxy repository: too young to trust.

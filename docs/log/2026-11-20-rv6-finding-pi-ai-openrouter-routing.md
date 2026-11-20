---
date: 2026-11-20
author: claude-agent
type: finding
card: RV6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/model/upstream.ts
  - packages/runner/test/rv6-upstream.test.ts
supersedes: none
---

**What.** pi-ai 1.3.0 can pin OpenRouter's upstream, and exposes what served a call only through its raw stream observer.

**Why.** RV-DES-11 asks whether the `provider` routing field can be passed without patching `node_modules`.

**Result.** Its chat completions adapter (`dist/api/openai-completions.js`) copies a model's `compat.openRouterRouting` into the body as `provider`; the type (`dist/providers/compat-schema.d.ts`, `OpenRouterRoutingSchema`) holds `order`, `only`, `ignore`, `allow_fallbacks`, `require_parameters`, `quantizations`, `data_collection`, `sort`, `max_price` and throughput and latency preferences. Its AssistantMessage has `responseId` and `responseModel` but no upstream; `onProviderStreamEvent` sees each parsed chunk before normalisation, and OpenRouter's chunks carry `provider`. The routing applies only on the `openai-completions` API, the one the runner accepts (it carries the seed). The config takes the first seven fields; `sort` and the price and throughput preferences pick an upstream by load, which is what a pin avoids.

**Consequence.** No limitation to record; nothing in `node_modules` was changed.

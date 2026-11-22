---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/deps.md
  - packages/server/package.json
  - "npm view @opentelemetry/sdk-trace-base@2.12.0 peerDependencies"
supersedes: none
---

**What.** The OTLP sink depends on `@opentelemetry/sdk-trace` 3.1.0, not `sdk-trace-base`, beside api 1.10.0, exporter-trace-otlp-http 0.301.0 and `@opentelemetry/resources` 3.1.0.

**Why.** `sdk-trace-base` 2.12.0, the version the research note names, has the peer range `@opentelemetry/api >=1.3.0 <1.10.0`, so it refuses api 1.10.0, and exporter 0.301.0 depends on `@opentelemetry/sdk-trace` 3.1.0, the 3.x name of the same package (`sdk-trace-base` has only a 3.0.0 development build). Resources is already in the tree; naming it pins it and sets `service.name` engram without the default process attributes.

**Result.** All four are Apache-2.0 and at least 16 days old on 2026-11-21 (npm publish times: 2026-10-20 and 2026-11-05). Each has a row in `docs/deps.md`.

**Consequence.** Exporter 0.301.2 may be taken after 2026-11-26.

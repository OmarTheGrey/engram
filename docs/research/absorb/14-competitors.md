# 14-competitors: competitor analysis, November 2026

## Executive summary

Read from vendors' own pages on 2026-11-21. Three findings matter for the deck. First, no memory vendor documents a write-time policy gate or a recall explanation. Memory products sell scoping, storage and retrieval. Governance (audit, SSO, SOC 2, BYOK, VPC) is an Enterprise-plan add-on, as at Zep, Supermemory and Mem0. Second, the biggest platforms document memory governance gaps themselves: Microsoft says Purview retention does not apply to Copilot memory, memory actions write no audit entries, and admins cannot restrict what is remembered. Claude owners cannot see member memories, and member edits are not logged. ChatGPT and Microsoft both say deleting a chat does not delete the memory made from it. Third, security vendors (Lakera, Prompt Security, Prisma AIRS) and agent platforms (Glean, Credal) sell detectors, gateways, identity and audit, and Glean lists memory scanning as "coming soon". Engram's niche is open, but it is missing what buyers treat as table stakes: authentication and SSO or RBAC on the server, PII and secret detection, injection screening, SIEM or OTel audit export, DSAR export and erase reports, and import of memory from other assistants. Seven PR plans below close these, ordered by value.

Legend for the matrix: Y = stated in the vendor's own docs. P = partial or conditional (plan or preview). N = vendor's docs state it is absent. `?` = not found on pages read (not a claim of absence). Cells marked `*` rest on a third-party source and are unverified.

## Feature matrix (20 capabilities, 17 products)

Columns: M0 Mem0, ZP Zep, LT Letta, SM Supermemory, MB Memobase (OSS), GL Graphlit, GPT ChatGPT, CL Claude, GM Gemini Enterprise, MS Microsoft 365 Copilot + Purview, GLN Glean, CR Credal, LK Lakera Guard, PS Prompt Security, PA Prisma AIRS, WR Writer, EN Engram (from repo code and ADRs).

| Capability | M0 | ZP | LT | SM | MB | GL | GPT | CL | GM | MS | GLN | CR | LK | PS | PA | WR | EN |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 Write-time policy gate | ? | ? | ? | ? | ? | ? | ? | ? | ? | N (cannot restrict content) | P (checks write actions) | P (enforced params) | P (screens I/O) | P | P | ? | Y |
| 2 Per-user or scope isolation | Y | ? | ? | P (per-tag, Scale) | Y (per user) | ? | Y | Y | Y | Y | Y | Y | n/a | n/a | n/a | ? | Y |
| 3 Team or role sharing | ? | ? | Y (shared blocks, Teams) | P | ? | ? | P (projects) | P (projects) | ? | ? | Y | Y | n/a | n/a | n/a | ? | Y |
| 4 Consent grants per person | ? | ? | ? | ? | ? | ? | P | P (sensitive opt-in) | P (per-source toggles) | P | ? | ? | n/a | n/a | n/a | ? | Y |
| 5 Org kill switch | ? | ? | ? | ? | n/a | ? | Y (role enablement) | Y | Y | Y | ? | ? | n/a | n/a | n/a | ? | P |
| 6 User view, edit, delete | ? | ? | Y | ? | ? | ? | Y | Y | Y | Y | n/a | n/a | n/a | n/a | n/a | ? | P (inspector) |
| 7 Retention or expiry | P (expiration filter) | P (log retention) | ? | ? | ? | ? | P (30-day) | P (org, not project) | ? | N for memory | ? | ? | n/a | n/a | n/a | ? | Y |
| 8 Audit log of memory actions | P (Custom plan) | P (Enterprise) | ? | ? | ? | ? | ? | P (org toggles only) | ? (not covered) | N | Y | Y | P | Y | Y | P* | Y |
| 9 Explain why recalled | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | P (audit trail) | n/a | n/a | n/a | P* | Y |
| 10 Bi-temporal validity | ? | P (temporal graph, see note 2501.13956) | ? | ? | P (event timeline) | ? | ? | ? | ? | ? | ? | ? | n/a | n/a | n/a | ? | Y |
| 11 Conflict or contradiction handling | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | n/a | n/a | n/a | ? | Y |
| 12 Injection or poisoning defence | ? | ? | ? | ? | ? | ? | ? | ? | ? | P (Purview risky-AI template) | P (runtime) | ? | Y | Y | Y (memory manipulation) | ? | P |
| 13 PII or sensitive detection | ? | ? | ? | ? | ? | ? | ? | P (sensitive topics) | ? | P (classifiers) | P | ? (page silent) | Y* | Y | ? | ? | N |
| 14 SSO or RBAC | Y (Custom) | Y (Enterprise) | Y (Enterprise) | Y (Enterprise) | N | ? | Y | Y | Y | Y | Y | Y | ? | ? | Y (agent identity) | P* | N |
| 15 SOC 2 or HIPAA | P* (Type I, unverified) | Y (II, BAA) | ? | Y (Scale+) | N | N (coming) | P (BAA, not memory) | P (HIPAA orgs) | ? | Y | Y | P (labels) | ? | ? | ? | P* | N |
| 16 Self-host, VPC or on-prem | Y (Custom, OSS) | Y (BYOC) | Y (OSS) | Y (Scale, air-gap) | Y | N | N | N | N | n/a | ? | Y (VPC) | P (self-hosted policies) | ? | ? | ? | Y |
| 17 Portability (export, import) | ? | ? | ? | ? | ? | ? | ? (page silent) | P (experimental) | P (import rolling out) | P (eDiscovery export) | n/a | n/a | n/a | n/a | n/a | ? | P |
| 18 DSAR, eDiscovery | ? | ? | ? | ? | ? | ? | ? | P (data export) | ? | Y | ? | ? | n/a | n/a | n/a | ? | P (offboard) |
| 19 Simulate policy before rollout | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | P (monitor mode) | ? | P (red team) | ? | Y |
| 20 Procedure mining and replay | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | n/a | n/a | n/a | ? | Y |

How to use it: row 1, 9, 10, 11, 19 and 20 are where Engram is the only product with Y. Rows 12 to 14 and 17 to 18 are where Engram trails. `?` for the memory vendors means the vendor's page lists neither presence nor absence; it is not evidence of a gap. Only claim "none documents X" with the sentence "in the pages we read on 2026-11-21".

## Vendor facts that back the matrix (vendor-own pages unless marked)

| Product | Verified facts | Source |
|---|---|---|
| Mem0 | Free (unlimited end users, 10,000 adds and 1,000 retrievals in first 30 days, 50,000 and 10,000 with own LLM key) and Custom (contact sales). Custom adds graph memory, user profiles, Dream consolidation, analytics, SSO, audit logs, SLA, on-prem. Page names no SOC 2 or HIPAA; trackers say Starter $19 and Pro $249 were dropped (unverified, trackers). Repo Apache-2.0, 69,295 stars, pushed 2026-11-18. | mem0.ai/pricing, gh api |
| Zep | Free 10,000 credits, Flex $125 per month, Flex Plus $375, Enterprise custom. Retrieval and storage 0 credits. SOC 2 II, HIPAA BAA, BYOK, BYOC, SSO and SCIM, audit and 1-year API logs on Enterprise only. Graphiti Apache-2.0, 32,972 stars. | getzep.com/pricing |
| Letta | Free (3 agents), Pro $20, Teams Pro $20 per seat (shared agents, access control), Enterprise (RBAC, SAML or OIDC). Page does not mention audit or self-host. Repo Apache-2.0, 25,506 stars, pushed 2026-10-18. | docs.letta.com/letta-code/pricing |
| Supermemory | Free $0 ($5 credits), Pro $19, Max $100, Scale $399 (SOC 2, HIPAA BAA, self-host, per-tag access), Enterprise (air-gapped, SSO). Local binary capped at 10,000 documents and not open source. Repo MIT, 31,680 stars. | supermemory.ai/pricing |
| Memobase | Open source Apache-2.0, 2,962 stars, last push 2026-01-11 (slowing). User profiles plus event timeline, buffer, Python, Node, Go SDKs, MCP. Cloud price page 404. | GitHub |
| Graphlit | Pricing page says Graphlit is winding down, signups closed. SOC 2 only "coming soon". | graphlit.com/pricing |
| ChatGPT | Saved memories vs chat-history reference, temporary chat chosen up front, project-only memory and admin role enablement in Healthcare and Regulated Enterprise, off by default; improved memory not covered by BAA; deleting chat does not delete the memory. | help.openai.com article 8590148 |
| Claude | Per-project memory, per-chat off, incognito, org toggle, owners cannot view or edit member memory; member edits not logged; org retention applies except project memory; import and export experimental. | support.claude.com article 11817273 |
| Gemini Enterprise | Admin can turn off Memory org-wide; per-user toggles for history, sources and saved memories; no retention period, audit or residency stated on the page. Consumer Gemini: Personal context page; import rolling out (secondary reports). | docs.cloud.google.com personalization; support.google.com/gemini 16413516 |
| Microsoft | Memory in Exchange hidden folder; Enhanced personalization control; Purview retention does not apply to memory; no memory audit entries; admins cannot restrict content; eDiscovery plus Graph deletion. Purview covers DSPM for AI, audit, DLP, labels, insider risk, comms compliance, retention for prompts and responses. | learn.microsoft.com (two pages) |
| Glean | Permission checks on every read and write, SIEM streaming, write-action checks, SOC 2 II, ISO 42001, HIPAA; memory security scans "coming soon". | glean.com/security |
| Credal | MCP platform, agent registry, permission sync, approvals, enforced parameters, consolidated audit log, VPC; SOC 2, GDPR, CCPA labels. Marketing figures unverified. | credal.ai |
| Lakera | Detector types prompt_attack, pii, moderated_content, unknown_links, custom; enforce vs monitor per project (third-party integration docs plus docs.lakera.ai snippets). Check Point announced the acquisition (about $300 million reported); close and pricing not found. | search results only |
| Prompt Security | MCP gateway with risk scores, shadow-AI discovery, logging. SentinelOne announced the acquisition August 2025; close not confirmed here. | SentinelOne and BusinessWire results |
| Prisma AIRS 3.0 | Launched 2026-03-23; agent runtime security names tool misuse and memory manipulation; agent identity; artifact scanning of MCP servers and skills; red teaming. | Palo Alto press and blog |
| Writer | Only secondary sources and a failed fetch of the vendor page (403). RBAC, guardrails and audit claims are `*` unverified. | search only |
| Protect AI | llm-guard repo is MIT, 3,221 stars, archived, last push 2026-07-08 (gh api). Palo Alto link not verified in this pass. | gh api |

## Landscape (absorbable items)

| Name | URL | Licence | Stars, last activity | Language | Gives us | Mode |
|---|---|---|---|---|---|---|
| Presidio | github.com/microsoft/presidio | MIT | 11,992, 2026-11-19 (note repo-presidio) | Python | PII recognisers to port as patterns | ideas, port patterns |
| gitleaks | github.com/gitleaks/gitleaks | MIT | 31,230, 2026-10-28 | Go | 222 secret rules to port as data | port rules |
| secretlint | github.com/secretlint/secretlint | MIT | 1,503, 2026-11-21 | TypeScript | npm secret detection | depend |
| OpenTelemetry JS | github.com/open-telemetry/opentelemetry-js | Apache-2.0 | 3,535, 2026-11-20 | TypeScript | OTLP export of events | depend |
| llm-guard | github.com/protectai/llm-guard | MIT | 3,221, archived | Python | scanner catalogue of ideas | ideas only (archived) |
| NeMo Guardrails | github.com/NVIDIA-NeMo/Guardrails | Apache-2.0 (GitHub API says NOASSERTION; LICENSE.md carries an Apache-2.0 SPDX header, read 2026-11-21) | 7,538, 2026-11-19 | Python | rails vocabulary | ideas (Python, nothing to depend on in TS) |
| Guardrails AI | github.com/guardrails-ai/guardrails | Apache-2.0 | 7,631, 2026-11-18 | Python | validator catalogue | ideas |
| PurpleLlama | github.com/meta-llama/PurpleLlama | NOASSERTION; top-level LICENSE is the Llama 3.2 Community Licence (not OSI, use restrictions), so not absorbable | 4,486, 2026-11-20 | Python | PromptGuard, benchmarks | ideas only |
| better-auth | see note repo-better-auth-oauth-provider | MIT | about 30.8k | TypeScript | OAuth 2.1 and OIDC for server and MCP | depend |
| jose | github.com/panva/jose | MIT | 7,891, 2026-11-18 | TypeScript | JWT verification | depend |
| Cerbos, SpiceDB, OpenFGA | gh api | Apache-2.0 | 4,665 / 7,233 / 6,171 | Go | authz sidecars (no for in-process) | ideas (see repo-policy-engines-compared) |
| Mem0, Graphiti, Letta, Cognee, MemOS, Supermemory | gh api | Apache-2.0, Apache-2.0, Apache-2.0, Apache-2.0, Apache-2.0, MIT | 69,295 / 32,972 / 25,506 / 33,442 / 12,469 / 31,680 | Py, Py, n/a, Py, TS, TS | store adapters, import formats | adapters (depend) |

## Buyer-expected features Engram lacks, ranked

1. Authentication and RBAC on the HTTP server and MCP (the server is loopback, no auth). Every product above sells SSO or RBAC.
2. PII and secret detection at the write gate. Lakera, Prompt Security and Microsoft classifiers do it.
3. Injection and poisoning screening of write candidates. Prisma names memory manipulation explicitly.
4. SIEM and OTel export plus webhooks (Glean streams to SIEM; Zep bills webhooks).
5. Data-subject export and erase report with derived-from closure (Microsoft eDiscovery; OpenAI documents the closure problem).
6. Memory import from other assistants (Claude, Gemini, ChatGPT); the other agent's note repo-chatgpt-claude-memory-formats covers formats.
7. Approval workflow for sensitive writes with approver record (Credal).
8. Org kill switch, pause versus reset, per-project inherit flag (Claude, Microsoft, Gemini).
9. Shadow-memory discovery across a machine (Prompt Security's shadow AI, Prisma's discovery).
10. Compliance report mapped to controls (Purview Compliance Manager templates).
11. Connectors with source-permission sync (Glean, Credal, Supermemory). Out of scope: not a memory governance feature.

## PR plans

**AB-CMPT-1: Write-gate detectors, PII and secrets.** Goal: a pluggable deterministic detector stage in the gate that blocks or tags a write containing a secret or PII class, with a reason. Absorbs: gitleaks rule data (MIT) and Presidio patterns (MIT), secretlint as optional dependency. Files: `packages/core/src/policy/detectors.ts` (pure, no I/O), `policy/evaluate.ts` (`evaluateWrite`), the policy file schema in `policy/load.ts` (detector config; if `schema.ts` or `schema_version` changes it is its own PR per rule 5), `fixtures/faults`, `NOTICE`. Reuse and consolidate the secret patterns already in `packages/core/src/plane/bypass.ts`. Effort M. Port gitleaks rules as generated data (222 `[[rules]]` verified in config/gitleaks.toml), translating Go RE2 syntax to JavaScript regex; secretlint is not a core dependency (core stays pure). Depends on: a schema PR slot. Value: closes buyer gaps 2 and answers Lakera and Microsoft DLP; thesis: a new fault class for H3 lint recall. Risks: false positives; rule data licences are MIT but attribute in NOTICE. Acceptance: `make test-one T=packages/core/test/unit/policy/detectors.test.ts` plus a fault fixture the gate blocks with reason `detector:secret`.

**AB-CMPT-2: Injection and poisoning screen as an injected `ModelCall` lint.** Goal: the model-based lint tier (`MODEL_LINT_IDS` is `contradiction`, `unsupported-claim` today, in `packages/core/src/lint.ts`) gains a third lint that flags imperative, instruction-like or origin-mismatched text in stored candidates, seeded and cached. It is an advisory lint over the projection, not a write-time gate (the plane never calls a model). Absorbs: ideas from llm-guard (archived, ideas only), Guardrails AI validators, existing notes 2407.12784-agentpoison and 2607.14651-mempoison. Files: `packages/core/src/lint.ts` and `lint/model.ts` (new id, prompt, schema, severity), a schema PR if lint ids appear in the event schema (rule 5), `fixtures/faults/model`, `fixtures/cassettes`, `research/configs`, and a preregistration amendment first (AGENTS.md forbids adding a method not in it). Effort M. Depends on: L3 (merged) and the amendment. Value: answers Prisma and Lakera; thesis: tests the poisoning arm. Risks: rule 4, no pi-ai in core (use the injected function). Acceptance: `make run CONFIG=research/configs/l3-lint-fixture.json` extended with an injection fixture, zero new calls.

**AB-CMPT-3: Audit export, OTLP and webhooks.** Goal: stream events to OTLP, a JSONL sink and signed webhooks (HMAC), filterable by decision. Absorbs: OpenTelemetry JS (Apache-2.0), GenAI semconv note repo-otel-genai-semconv. Files: `packages/server/src/export.ts` (no new package: the AGENTS.md map has none), `docs/deps.md`, an ADR (the plane gains outbound network egress, which loopback-only ADR 0027 did not contemplate), no change to core. Effort M. Depends on: none (outbound sinks need no inbound auth). Value: matches Glean SIEM streaming; Zep webhooks. Thesis: none. Risks: events must not leak content (rule 12 aggregate-only for dogfood). Acceptance: `make test-one T=packages/server/test/export.test.ts` replays a log and compares emitted spans to golden.

**AB-CMPT-4: Server and MCP authentication, OIDC and API keys with roles.** Goal: bearer-token auth on `engram serve` and `engram mcp --http`, mapping a token's subject to an actor and member scopes, with jose (MIT, 6.2.18) for JWT verification and hashed API keys as the base; better-auth (MIT, 1.7.27) is a full auth framework with its own user store, optional, only if OAuth 2.1 for remote MCP clients is wanted (note repo-better-auth-oauth-provider). Files: `packages/server`, `packages/mcp`, `packages/cli`, `docs/deps.md`; policy mapping stays in core. Effort L. Depends on: none. Value: highest buyer gap; thesis: enables multi-actor dogfood. Risks: needs an ADR amending ADR 0027 decision 4 and closing the backlog row "Authentication for the HTTP and MCP surfaces"; the "no authentication yet" statement in AGENTS.md must change; token handling bugs. Acceptance: `make test-e2e` with an unauthenticated call refused and an event recorded for the denial.

**AB-CMPT-5: Org kill switch, pause versus reset, inherit flag.** Goal: policy fields for an org-level memory switch, `pause` (stop use and creation, keep data) and `reset` (retire all) as distinct Plane operations with events; a project scope may opt out of inheriting person memory. Absorbs: Claude and Microsoft control models (ideas). Files: policy fields in `policy/load.ts` (a `schema.ts` change is its own PR first, rule 5), `plane/retention.ts`, `plane/offboard.ts` (reset must reuse its erase path and hash-keeping, ADR 0025 and 0034), a new `plane/pause.ts`, CLI and UI. Effort M. Depends on: the schema PR if any. Value: matches Claude, Gemini and Microsoft; thesis: new invariant (paused scope yields no reads). Risks: invariant interplay with the seven invariants. Acceptance: `make test-invariants` with a paused-scope invariant.

**AB-CMPT-6: DSAR export and erase report, plus compliance map.** Goal: `engram export --subject <id>` produces every item and decision about a person; a derived-from closure query reports what remains after an erase. Offboarding (cards E2.6 and E9.7, `plane/offboard.ts`) already erases a person scope and emits a deletion report, so this plan adds only the export, the closure report and the compliance map, not a second erase. A generated document maps events to controls (EU AI Act, ISO 42001, SOC 2 evidence) in the style of Compliance Manager templates. Files: `packages/core/src/plane`, `packages/cli`, `docs/compliance/`. Effort M. Depends on: none (E2.6 and E9.7 merged). Value: answers Microsoft eDiscovery and OpenAI deletion semantics; thesis: lineage query evaluated. Risks: the compliance mapping must not claim certification. Acceptance: `make test-one T=packages/core/test/unit/plane/dsar.test.ts`.

**AB-CMPT-7: Memory import from other assistants and stores.** Goal: parse Claude pasted-text memory and the ChatGPT data export ZIP (no vendor publishes a schema; see the format note) and feed each item as a gated write with provenance `import`, candidate status. Not `external`: no bundled preset allows `external` (ADR 0004), so every write would be denied. Mem0 and Letta stores are already adopted through `adopt.ts` and the existing adapters (RV4), so they are out of scope; Zep, Supermemory and Gemini dumps are dropped as unverified formats. Files: `packages/cli/src/import/` (parsers; no policy logic), no change to `packages/adapters`. Effort M. Depends on: none hard (AB-CMPT-1 is useful so imported secrets are blocked). Value: migration story against vendors' own import features; thesis: adoption never raises trust (RV4). Acceptance: `make test-e2e` import then explain shows `import` source.

## Recommended order

1. AB-CMPT-4: every competitor sells authentication, and the loopback-only server blocks any real pilot or demo to the supervisor.
2. AB-CMPT-1: cheapest visible parity with Lakera and Microsoft DLP, deterministic, and adds a fault class to the thesis.
3. AB-CMPT-6: turns the documented deletion weakness (Microsoft, OpenAI, Claude) into Engram's headline demonstration, and builds on events and provenance already present.

## Unverified claims

- Mem0 SOC 2 Type I and Type II status (trust page returned no content; only trackers).
- Mem0 historical Starter and Pro prices (trackers only).
- Lakera: acquisition closure, pricing, current detector list (third-party docs only).
- Prompt Security: acquisition closure (announcement only); SentinelOne blog fetch returned 429.
- Writer: all feature claims (vendor page returned 403).
- Protect AI and Palo Alto relationship, Protect AI current product set.
- ChatGPT: memory export, per-plan availability (page silent).
- Gemini: consumer import rollout (secondary sources).
- Letta: audit, self-host, MemFS from the pricing page (not stated there).
- Memobase Cloud pricing (404).
- Licence of PurpleLlama per subdirectory (top-level file is the Llama community licence; treated as ideas only).
- Credal accuracy and savings figures (marketing).
- Engram column of the matrix is from grepping `packages/*/src` for keywords, not a full audit.

## Verification (2026-11-21)

Checked by `gh api`, `npm view`, arxiv abs pages and grep of the repo.

Repositories verified (licence, stars, last push all match the report): presidio, gitleaks, secretlint, opentelemetry-js, llm-guard (MIT, archived), Guardrails AI, better-auth (MIT, npm 1.7.27), jose (MIT, 6.2.18), cerbos, spicedb, openfga, mem0, graphiti, letta, cognee, MemOS, supermemory, memobase, and semantic-conventions-genai (Apache-2.0, 556 stars). Gitleaks rule count 222 confirmed.

Corrected:
- NeMo Guardrails is Apache-2.0 (SPDX header in LICENSE.md; the API says NOASSERTION). Was "ideas only until licence read".
- PurpleLlama top-level licence is the Llama 3.2 Community Licence: ideas only, firmly.
- Matrix heading said 18 capabilities; it has 20.
- Test paths: core tests live under `packages/core/test/unit/`.
- AB-CMPT-1: secretlint removed from core; existing `plane/bypass.ts` secret patterns to be reused; policy config location is `policy/load.ts`.
- AB-CMPT-2: the lint is advisory over the projection, not a write-time screen; needs a preregistration amendment and a lint-id change.
- AB-CMPT-3: no new package; needs an ADR for egress; dependency on AB-CMPT-4 removed.
- AB-CMPT-4: jose plus API keys as the base, better-auth optional; ADR 0027 amendment named.
- AB-CMPT-5: rule 5 forbids bundling the schema change; reset must reuse offboard.
- AB-CMPT-6: erase already exists (E2.6, E9.7); scope cut to export, closure report, compliance map.
- AB-CMPT-7: `external` provenance would be denied by every preset (ADR 0004); use `import`; Mem0 and Letta are already adopted; unverified vendor formats dropped.

Papers: 2407.12784 (AgentPoison), 2607.14651 (MemPoison), 2501.13956 (Zep) resolve to the titles the notes give.

Notes checked (6): repo-presidio, repo-better-auth-oauth-provider, repo-otel-genai-semconv, repo-policy-engines-compared, repo-chatgpt-memory-controls, repo-chatgpt-claude-memory-formats. Frontmatter ids match filenames, code URLs valid, no em dashes; no edits needed.

Not refuted but unverified: vendor pricing and compliance claims (vendor pages, not re-fetched here); the Engram column is a keyword grep.

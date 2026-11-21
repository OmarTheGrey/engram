# ADR 0043: Decisions may leave the machine as OpenTelemetry spans, opt-in, carrying no memory content

Status: proposed, 2026-11-21
Deciders: drafted by card E8.13 of the absorb plan; for the lead's acceptance (`docs/tasks/lead-decisions.md`, item 61)
Supersedes: nothing. It is the first ADR on egress: until now nothing Engram writes leaves the machine except a model call (ADR 0017) and the cassette deposit (ADR 0036).

## Context

- **What the card asks.** An organisation already runs an observability stack. Card E8.13 exports each policy decision as an OpenTelemetry span, so decisions sit beside the model calls they governed, with no new tool to audit them.
- **Rule 12.** Dogfood content, the team's sessions and memories, never leaves a member's machine. A span sent to a collector leaves it.
- **What an event holds.** A MemoryEvent carries the item it produced: its content, its provenance ref (often a file path or a URL), the sha256 of its evidence, its store key (a path inside a store), its grants' principals. Its reason is free text: most producers name only enums, counts and ids, but a bypass's reason keeps the command attempted, a lint's reason its evidence (a provenance ref, a strict content hash), and a store failure the store's error message, which can hold a path.
- **The conventions.** The OpenTelemetry GenAI semantic conventions (`open-telemetry/semantic-conventions-genai`, v0.1.0, commit d0e74ba, Apache-2.0, on semantic conventions v1.45.0) define a memory span, `gen_ai.memory.client`, with operations such as `upsert_memory` and `search_memory`. Its content attributes (`gen_ai.memory.records`, `gen_ai.memory.query.text`) are opt-in upstream and "SHOULD NOT" be captured by default. Every name is Development status.

## Decision

1. **Off unless named.** Nothing is exported unless the operator names a sink: `--otlp <url>` or `ENGRAM_OTLP_URL` for OTLP over HTTP, `--export-jsonl <file>` or `ENGRAM_EXPORT_JSONL` for a local file. The standard `OTEL_*` variables never turn an export on, since an organisation may set them for every process; once an export is on, the OTLP exporter reads its headers and certificates from them, as any OTel exporter does. No registered condition, preset or config names a sink. There is no webhook.
2. **What leaves.** One span per event, named by its GenAI operation, with: the event's id, sequence number and time; its op, decision and policy id (the rule); the actor's id; the source and target scopes; the item's id, class, status, version, provenance kind and grant count; the store adapter's name (never its key); the store name a bypass record names, which the caller of the bypass route chooses, so it leaves as that caller wrote it, held to lowercase letters, digits and hyphens by the bypass templates; the returned count of a read; model usage in tokens and dollars; a lint's id and severity; and the reason filtered as in decision 4. The resource carries `service.name` `engram` and nothing about the host, the process or its command line. Trace and span ids derive from the event id, so a span is the same on every export of one event.
3. **What never leaves.** The content; the provenance ref, hash and session entry; the store key; grant principals, lineage and validity windows; a read's query and the ids it returned; and the upstream opt-in content attributes. There is no option to send them. A content hash is excluded too, since the sha256 of a guessable memory is reversed by a lookup.
4. **Reasons by template only.** A reason is split into clauses, and a clause is exported only when its whole text matches a template whose every slot admits an enum value, a number, a UUID, a scope, a time or a rule name: the write gate, the provenance note, the read's counts, the injection screen (card E2.10), the content guards (card E2.9), the bypass record's first clauses and retention. A producer that changes its wording is withheld until its template is added: the failure is closed.
   - *Amended 2026-11-21 by the review fix pass (finding E8.13-1, the lead's decision).* From the first clause that matches no template, that clause and every clause after it are withheld, as one `[withheld]` marker, and all of them are counted. Free text (a bypass's command, a lint's evidence, a store's error) may hold fragments shaped like a template, such as `; it targets person:<secret>`, and the slots admit most short tokens, so nothing after free text is judged. Every producer puts its free text at the tail, so no clause kept before is lost. Each template family is also kept only on the ops whose reasons it comes from (the write gate's on write, update, promote and gate; the read's counts on read; retention's on retire and evict; the bypass record's on bypass_blocked; none on lint), since a bypass's store name, set by the caller, stands at the head of its reason.
   - *Amended 2026-11-21 (finding E8.13-2).* The expiry template keeps the item's id and exports its expiry time, `valid_from` and ttl as `[time]` and `[ttl]`, so decision 3 holds for retention reasons too.
5. **Where it lives.** The mapping is a pure function in core (`packages/core/src/export/otel.ts`), which gains no dependency. The sinks are in `packages/server` and the flags in the CLI; `engram serve` and every in-process command that opens the log export the events appended after it started, whichever handle appended them. A failed export is reported on stderr and never fails the call it followed.
6. **How rule 12 is kept.** Spans hold identifiers and decisions, never what a memory says, so an export carries no dogfood content by construction. Actor ids and scopes are identifiers of people (`person:<id>`); an operator who must not send even those does not turn the export on, or uses the JSONL sink and keeps the file local. The content-free test (`packages/core/test/unit/export/otel.test.ts`) runs over every op, plants a secret in every item field, in queries and in a bypass command, and fails if it reaches any attribute.

## Alternatives considered

- **(b) Export the full reason.** The most useful span, and it sends the bypass's command, the lint's evidence and a store's error text, each of which can hold content or a path.
- **(c) An opt-in content mode**, mirroring upstream's content-capture setting. It would make rule 12 depend on a flag a member could set by mistake, for a dogfood log that must never leave.
- **(d) No reason at all, the policy id only.** Safe and simple; the rule says which check decided but not with what numbers, and the injection screen's and guards' kinds and lengths are lost.
- **(e) Honour `OTEL_EXPORTER_OTLP_ENDPOINT`** as the switch. The standard convenience, and it would turn the export on in any environment an organisation configured for other services.

## Consequences

- Card E8.13 ships the mapping, the two sinks and their tests; four packages are pinned in `docs/deps.md` (Apache-2.0).
- A new reason producer is withheld from spans until a template is added beside it in `otel.ts`; the template list is part of reviewing such a card.
- Attribute names may change upstream while they are Development; the pin and the one file are where a rename lands.
- Spans already sent stay at the collector: after an offboarding, they still name `person:<leaver>` and the scope ids, and the plane cannot erase them (rule 12). An operator who exports a person scope's decisions must erase them at the collector too (finding E8.13-3).
- Linking a decision span to the model call it governed needs trace context from the harness, which is out of scope (pi and the harnesses own model tracing); each decision is a root span today.

## Sources

- `docs/tasks/E8.13.md`; `docs/tasks/absorb-plan.md`, pull request 29.
- `docs/research/absorb/07-evalops.md`, AB-EVL-3; `docs/readings/litreview/repo-otel-genai-semconv.md`.
- `open-telemetry/semantic-conventions-genai` at v0.1.0: `docs/gen-ai/gen-ai-spans.md` (Memory), `docs/registry/attributes/gen-ai.md`.
- AGENTS.md rule 12; ADRs 0017, 0036, 0037 and 0039.

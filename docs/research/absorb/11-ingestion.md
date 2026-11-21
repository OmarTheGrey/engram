# 11 Ingestion: documents, web and multimodal sources into governed memory

## Executive summary

Engram has provenance kinds `document` and `external` but no way to ingest anything. Worse, the `source-changed` lint (`packages/core/src/lint/det.ts`) only fires when `provenance.ref` names another memory item (`item:<uuid>`), so a memory derived from a PDF, a web page or a recording can never be flagged as stale. The fix is a small, ordered stack. First, a schema PR adding an optional span locator to `Provenance` (W3C TextQuote plus TextPosition style). Second, a `Converter` boundary outside core (pdf.js, mammoth and Readability or Defuddle in TypeScript; Docling as an optional sidecar) that turns a file into extracted text plus blocks, stores that text as a source item, and writes chunk memories whose `ref` is that item and whose span points into it. Core's existing `source-changed` lint then works unchanged on the source item, and a new span re-anchor step reports anchored, moved or orphaned. Ingest is also a poisoning surface: a 2025 study reports 74.4% attack success against five popular loaders (357 scenarios), so the sanitiser and the low-trust kinds are part of the design, not an add-on. Audio is a documented extension point (whisper.cpp run outside the plane, output imported), not a first-wave card.

## Landscape

Facts from `gh api` on 2026-11-21 unless marked unverified.

| Name | URL | Licence | Stars, last push | Lang | Gives us | Mode |
|---|---|---|---|---|---|---|
| Docling (+docling-core) | github.com/docling-project/docling | MIT | 70,835; 2026-11-21 | Python | Layout parse, items with page, bbox, charspan; HybridChunker with item refs | depend (optional sidecar), ideas |
| MarkItDown | github.com/microsoft/markitdown | MIT | 197,308; 2026-11-07 | Python | Many formats to Markdown; no span locators (unverified) | ideas only |
| pdf.js | github.com/mozilla/pdf.js | Apache-2.0 | 54,164; 2026-11-20 | JS | PDF text with page and positions; default PDF path | depend |
| unpdf | github.com/unjs/unpdf | MIT | 1,279; 2026-11-15 | TS | Serverless pdf.js wrapper | depend (alternative) |
| mammoth.js | github.com/mwilliamson/mammoth.js | BSD-2-Clause | 6,346; 2026-10-16 | JS | DOCX to HTML or Markdown | depend |
| Readability | github.com/mozilla/readability | Apache-2.0 | 11,561; 2026-08-04 | JS | Main-content extraction | depend |
| Defuddle | github.com/kepano/defuddle | MIT | 10,126; 2026-11-20 | TS | Main-content extraction, Markdown out | depend (alternative) |
| Trafilatura | github.com/adbar/trafilatura | Apache-2.0 | 7,158; 2026-11-20 | Python | Web extraction with metadata | ideas only |
| Turndown | github.com/mixmark-io/turndown | MIT | 11,516; 2026-11-04 | JS | HTML to Markdown | depend |
| cheerio / happy-dom | github.com/cheeriojs/cheerio | MIT | 30,552 / 4,754 | TS | DOM for Readability | depend |
| xberg (was kreuzberg) | github.com/xberg-io/xberg | MIT | 9,605; 2026-11-21 | Rust | Multi-format extraction; Node bindings unverified | ideas only |
| Unstructured | github.com/Unstructured-IO/unstructured | Apache-2.0 | 15,769; 2026-11-19 | Python | Partitioning elements | ideas only |
| Marker | github.com/datalab-to/marker | Apache-2.0 code; weights unverified | 41,006; 2026-11-20 | Python | PDF to Markdown | ideas only |
| MinerU | github.com/opendatalab/MinerU | NOASSERTION (not read) | 84,089; 2026-11-20 | Python | PDF parsing | not absorbable until read |
| whisper.cpp | github.com/ggml-org/whisper.cpp | MIT | 55,383; 2026-11-20 | C++ | Local ASR with timestamps | external tool |
| LlamaParse client | github.com/run-llama/llama_cloud_services | MIT, archived | 4,272 | TS | Hosted paid parser | not usable (no offline) |
| W3C Web Annotation selectors | w3.org/TR/selectors-states | W3C spec | n/a | n/a | TextQuote and TextPosition locators, anchor states | port (spec) |
| dom-anchor-text-quote | github.com/hypothesis/dom-anchor-text-quote | MIT, archived 2022 | 3 | JS | Reference anchoring | ideas only |
| semchunk / chonkie | isaacus-dev/semchunk; feyninc/chonkie | MIT / MIT | 670 / 4,850 | Python | Semantic chunkers | ideas only |

Papers: Docling (2501.17887); data-loader attacks (2507.05093); 36-strategy chunking study (2603.06976). Notes written under the research worktree (see end).

Design facts from the repo: `Provenance` is a strict object `{kind, ref, hash, actor, session_entry_id?, model?}`; `hash` is `sha256:<hex>` of evidence at write time; `refItemId` accepts only a bare UUIDv7 or `item:<id>`; the strict content hash NFKC-normalises and strips default-ignorable code points; `external` is denied by every bundled preset (ADR 0004).

## PR plans

### AB-ING-1: Span locator on provenance (schema PR)
- goal: a memory can name the exact span of its source, so recall explanations cite it and lints can re-check it.
- absorbs: W3C TextQuoteSelector and TextPositionSelector.
- files: `packages/core/src/schema.ts` (optional `provenance.span`: `{start, end, quote, prefix, suffix, chunker?}` and optional `locator` for page and bbox or time range), migration, `schema_version` bump, fixtures, `make api` output. Nothing else (Rule 5).
- effort: M. depends on: none.
- value: product, explanations that cite a span; thesis, a measurable provenance-completeness metric for Part I.
- risks: touches load-bearing core; every fixture regenerates. No licence risk (spec).
- acceptance: `make api-check && make test-one T=packages/core/test/unit/schema.test.ts` with a round-trip and old-version migration case.

### AB-ING-2: Governed document ingest pipeline
- goal: `engram ingest <file>` converts a file, stores the extracted text as a source item, writes chunk memories through `Plane.write` with kind `document`, ref `item:<source>` and a span, one event per chunk with reason.
- absorbs: pdf.js, mammoth, Docling (optional), chunking guidance from 2603.06976 (paragraph-group default, heading path kept).
- files: new `packages/ingest/` (Converter interface, pdf.js and mammoth converters, sanitiser, chunker; no policy), `packages/cli/src/commands.ts` (`ingest`: converts client-side with `packages/ingest`, then writes each chunk through the generated client's `POST /api/v1/items`, so no new server route or `make api` change is needed; the CLI holds no policy), `packages/mcp/src/server.ts` (a `memory_ingest` tool, matching the existing `memory_write`, `memory_read` names), `pnpm-workspace.yaml`, the AGENTS.md layout table, `docs/deps.md` (one row per package: pdfjs-dist 6.5.438 Apache-2.0, mammoth 1.13.0 BSD-2-Clause, pinned exactly and at least two weeks old), an ADR for the converter boundary. [Corrected in verification: tool name and CLI path.]
- effort: L. depends on: AB-ING-1.
- value: product, the missing front door; thesis, ingestion becomes a fault and poisoning surface.
- risks: parser output is not stable across versions (hash converter output and version). Rule 4: converters that call models are forbidden in the plane; Docling stays a sidecar run by the user. Licences are Apache-2.0, BSD-2, MIT: absorbable.
- acceptance: `make test-one T=packages/ingest/test/pipeline.test.ts`, fixtures with a two-column PDF and a DOCX; every chunk's span quote equals the source text at its offsets.

### AB-ING-3: URL ingest and web clipper
- goal: `engram ingest --url` and an MCP tool fetch a page, extract main content, record final URL, ETag, Last-Modified, raw-body hash and extractor version, and write kind `external` chunks.
- absorbs: Readability or Defuddle, Turndown, happy-dom.
- files: `packages/ingest/src/web.ts`, a fetch seam with an injected client (fakes, no network in tests), `packages/pi-extension/src/tools.ts` (a gated tool; every `external` write is denied by all bundled presets until a policy lists it, so a preset change in core is needed or the producer is inert), policy preset documentation. A browser extension is out of scope; the clipper is a CLI and tool that accepts HTML posted from any clipper.
- effort: M. depends on: AB-ING-2.
- value: product, URL-to-memory; thesis, the `external` kind finally has a producer (ADR 0004 asks for this to be its own PR after pre-registration).
- risks: network access in a gate-bearing path; SSRF (loopback and private ranges blocked by default); pre-registration must decide the poisoning-arm change first.
- acceptance: `make test-one T=packages/ingest/test/web.test.ts` on recorded HTML fixtures, including a hidden-text page whose hidden text is dropped and reported.

### AB-ING-4: Source re-verification on change
- goal: extend `source-changed` so a source registered by ingest is re-checked: re-fetch or re-read, compare raw and text hashes, re-anchor each span (anchored, moved, orphaned), emit a lint finding per memory, and for orphaned spans propose retirement for review.
- absorbs: W3C anchoring states; HTTP validators (ETag, If-None-Match) for cheap polling.
- files: `packages/core/src/lint/det.ts` (pure span re-anchor over the source item's content already in `ctx.items`; no I/O. A new lint id also edits `LINT_IDS` in `packages/core/src/lint.ts` and the `lints` enum in `schema.ts`, so it needs its own schema PR (rule 5) or must reuse `source-changed`), `packages/ingest/src/reverify.ts` (the I/O), `packages/cli` (`engram ingest --reverify`), the source-changed fault fixtures in `fixtures/faults/`.
- effort: M. depends on: AB-ING-1, AB-ING-2.
- value: product, stale document memories surface themselves; thesis, a new fault class and a staleness detection rate on edited-document fixtures.
- risks: fuzzy matching can anchor to wrong text, so every re-anchor is an event. Core must not do I/O, so the text is passed in.
- acceptance: `make test-one T=packages/core/test/replay/lint.test.ts` plus fault fixtures (`make fixtures` regenerates them; there is no `make lint-faults` target) showing detection on edit, move and delete cases at fixed seeds.

### AB-ING-5: Ingestion poisoning fault set and sanitiser evaluation
- goal: a fixture set of hostile documents (zero-width text, white-on-white, off-page, metadata, alt text) and a measure of what the sanitiser and the gate each stop.
- absorbs: taxonomy of 2507.05093; CrackedPDFs and Hidden-in-Plain-Text as pointers (not read in full).
- files: `fixtures/faults/ingest/`, `packages/bench/src/faults/generate.ts`, `research/scripts/` analysis, pre-registration addition first (`docs/research/preregistration.md`).
- effort: M. depends on: AB-ING-2.
- value: thesis, an ingestion arm for H1 with sanitiser off and on reported separately; product, a regression suite.
- risks: scope creep; the pre-registration change must be reviewed before any run (rule on not adding unregistered methods).
- acceptance: `make test-one T=packages/bench/test/faults/ingest.test.ts`, then a registered script regenerates the table.

### AB-ING-6: Docling sidecar converter (optional)
- goal: richer layout and table spans via `docling` run as a user-installed command, JSON output parsed into the same Converter result.
- absorbs: Docling, docling-core document model.
- files: `packages/ingest/src/converters/docling.ts`, doctor check, docs. No dependency added to the workspace.
- effort: S. depends on: AB-ING-2.
- value: quality on scientific PDFs for thesis fixtures.
- risks: Python and model weights; version drift, so record the Docling version in provenance; weights licences not verified.
- acceptance: `make test-one T=packages/ingest/test/docling.test.ts` against a committed Docling JSON fixture (no Docling run in CI).

### AB-ING-7: Audio transcript import (extension point)
- goal: import a whisper.cpp JSON or VTT transcript as segment chunks with time-range spans; the audio hash is the source hash; kind `import` (ASR output is imported content; `tool` ranks below it in ADR 0026's order); person scope only. [Corrected in verification.]
- absorbs: whisper.cpp output format.
- files: `packages/ingest/src/converters/transcript.ts`, docs.
- effort: S. depends on: AB-ING-2.
- value: Twin demo for meetings; thesis value low.
- risks: ASR is a model call, so it stays outside the plane (Rule 4); personal-data handling.
- acceptance: `make test-one T=packages/ingest/test/transcript.test.ts` on a committed transcript fixture.

## Recommended order

1. **AB-ING-1** first: everything else hangs on a span locator, and it is one reviewable schema PR with no dependencies. It also fixes the current gap that document-derived memories cannot be linted.
2. **AB-ING-2** next: the ingest pipeline is the visible feature, and by storing the extracted text as a source item it lets the existing `source-changed` lint work with no core change.
3. **AB-ING-4** third, ahead of the clipper: re-verification is the part that links ingestion to Engram's governance story and thesis (staleness as a lint), and it is more distinctive than URL capture. AB-ING-3 and AB-ING-5 follow; AB-ING-5 needs a pre-registration edit that should be started early.

## Unverified

- pdf.js bounding-box access, mammoth offsets, MarkItDown span support: not tested.
- Licences of marker weights, MinerU, jsdom: not read.
- xberg Node bindings; whisper Node wrappers' licences and output.
- Paper numbers come from abstract pages only; CrackedPDFs, Hidden-in-Plain-Text results and the late-chunking paper were not read in full.

## Verification (2026-11-21)

Checked:
- All 21 repositories via `gh api` (licence, stars, pushed date, archived flag). Every number in the landscape table matched, except whisper.cpp at 55,383 (was 55,384, fixed). MinerU is NOASSERTION: stays "not absorbable until read". Marker weights licence is unverified, so ideas only is right. No repo with a non-Apache-2.0-compatible licence is treated as absorbable. npm: pdfjs-dist 6.5.438 Apache-2.0, mammoth 1.13.0 BSD-2-Clause, @mozilla/readability 0.6.0 Apache-2.0 (last npm release 2025-03, though the repo was pushed 2026-08), defuddle 0.19.13 MIT, turndown 7.2.5 MIT, happy-dom 21.0.4 MIT, unpdf 2.2.1 MIT.
- Papers: 2501.17887 is "Docling: An Efficient Open-Source Toolkit for AI-driven Document Conversion"; 2507.05093 is "The Hidden Threat in Plain Text: Attacking RAG Data Loaders" (74.4% over 357 scenarios, five loaders, confirmed); 2603.06976 is "A Systematic Investigation of Document Chunking Strategies and Embedding Sensitivity" (paragraph group nDCG@5 about 0.459, fixed-size below 0.244, confirmed).
- Repo claims: `Provenance` strict object fields, `refItemId` (bare UUID or `item:`), `source-changed` comparing the ref'd item's strict hash to `provenance.hash`, and ADR 0004's `external` denied by every preset and its own-PR-after-prereg note all match the code and ADR. No ingestion code exists today (no duplicate work).
- Notes: repo-docling, repo-doc-parsers-ts, repo-web-capture-extractors, repo-web-annotation-selectors, repo-whisper-cpp-transcripts, 2507.05093, 2603.06976 checked for id, title and code URL; zero em dashes; one star count fixed (whisper note).

Corrected:
- MCP tool is named `memory_ingest`, not `engram_ingest` (existing tools are `memory_*`).
- CLI commands are generated-client calls; ingest should convert client-side and post items to `/api/v1/items`, avoiding a server route plus `make api`. A new package also needs the workspace file and AGENTS.md layout entry.
- Acceptance paths: schema test is `packages/core/test/unit/schema.test.ts`; `make lint-faults` does not exist.
- AB-ING-4: a new lint id touches `schema.ts` and `lint.ts`, so it cannot ride with the ingest PR; re-anchoring can be pure in core because the source text is an item in `ctx.items`.
- AB-ING-7: kind `import`, not `tool`. AB-ING-3: inert until a preset allows `external`.

Refuted: none of the repository or paper claims. Unverified still: pdf.js bbox access, mammoth offsets, MarkItDown spans, Docling model-weight licences.

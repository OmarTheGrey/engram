---
id: repo-doc-parsers-ts
title: Document parsers reachable from TypeScript: pdf.js, unpdf, mammoth, MarkItDown, xberg
authors: Mozilla; unjs; Williamson; Microsoft; xberg-io
venue: repositories
year: 2026
tier: new
topics: [ingestion, parser, pdf, office]
engram: [govern]
code: https://github.com/mozilla/pdf.js
sources_read: [gh api metadata for each repository]
---

## Claim
A TS-only parse path exists for PDF (pdf.js, unpdf), DOCX (mammoth) and HTML; richer layout needs Docling or a Rust or Python sidecar.

## Method
Metadata only, gh api on 2026-11-21. Nothing was benchmarked.

## Key numbers
- mozilla/pdf.js: Apache-2.0, 54,164 stars, pushed 2026-11-20. Per-item page and transform, so a bounding box should be derivable (not verified).
- unjs/unpdf: MIT, 1,279 stars, pushed 2026-11-15, TypeScript.
- mwilliamson/mammoth.js: BSD-2-Clause, 6,346 stars, pushed 2026-10-16. Output is HTML or Markdown, no offsets (not verified).
- microsoft/markitdown: MIT, 197,308 stars, pushed 2026-11-07, Python. Markdown out; span locators not verified.
- datalab-to/marker: Apache-2.0 code, 41,006 stars; its model weights may carry a separate licence (not verified).
- opendatalab/MinerU: licence reported as NOASSERTION, 84,089 stars; treat as not absorbable until read.
- xberg-io/xberg (the old kreuzberg path redirects here): MIT, 9,605 stars, pushed 2026-11-21, Rust. Bindings not verified.
- Unstructured-IO/unstructured: Apache-2.0, 15,769 stars, Python.
- run-llama/llama_cloud_services (LlamaParse client): MIT, archived, a hosted paid service, not usable offline.

## What Engram borrows
A parser behind a `Converter` interface returning text plus blocks with kind, optional page and bbox, and start and end offsets. pdf.js and mammoth are the default TS implementations; Docling is an optional sidecar.

## What Engram does differently
The converter output is itself hashed and kept; a parser upgrade makes a new version, not a silent edit.

## Risk to our claims
Offsets differ between parsers, so a span from one parser does not anchor in another's text. Anchor against the stored extracted text, not the original file.

## Open question
Is pdf.js text order good enough on two-column papers, or is Docling needed for thesis fixtures?

## Notes
none.

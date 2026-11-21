---
id: repo-docling
title: Docling and docling-core (DoclingDocument with item provenance)
authors: Livathinos et al., IBM Research (paper 2501.17887)
venue: arXiv 2025, MIT repository
year: 2025
tier: new
topics: [ingestion, provenance, parser, chunking]
engram: [govern, plane]
code: https://github.com/docling-project/docling
sources_read: [https://arxiv.org/abs/2501.17887, https://docling-project.github.io/docling/concepts/docling_document/ via search summary, search results on HybridChunker doc_items]
---

## Claim
Docling converts PDF, DOCX, HTML and more into one structured document model whose items keep page number, bounding box and character span, so a chunk can point back to where it came from.

## Method
Layout analysis (DocLayNet) and table structure recognition (TableFormer) feed a Pydantic DoclingDocument. Each item has a provenance entry (page_no, bbox, charspan). The HybridChunker emits chunks whose metadata lists the doc items they came from, by self_ref such as `#/tables/0`.

## Key numbers
- Repository (gh api, 2026-11-21): MIT, 70,835 stars, pushed 2026-11-21, Python. docling-core: MIT, 300 stars, pushed 2026-11-20.
- The paper abstract gives no speed numbers.

## What Engram borrows
The shape: a parsed source with stable item refs, each carrying a locator. Engram would call Docling as an out-of-process converter, never inside core, and keep its JSON beside the source.

## What Engram does differently
Docling stops at the document. Engram turns each chunk into a governed memory item with a kind, a hash and a gate decision.

## Risk to our claims
Python with model weights: heavy, and a model-based parser makes ingest nondeterministic across versions. Pin the version and hash the converter output, not only the source.

## Open question
Is a sidecar process acceptable under the no-Docker and TS-first constraints, or does the product ship only the TS path and keep Docling for research?

## Notes
Exact field names of the current API were not verified against an installed version.

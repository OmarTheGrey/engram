---
id: repo-web-capture-extractors
title: Web capture extractors: Readability, Defuddle, Trafilatura, Turndown
authors: Mozilla; kepano; Barbaresi; Mixmark
venue: repositories
year: 2026
tier: new
topics: [ingestion, web, provenance, source-change]
engram: [govern]
code: https://github.com/mozilla/readability
sources_read: [gh api metadata for each repository]
---

## Claim
Main-content extraction from a web page is a library problem in TypeScript (Readability, Defuddle) and Python (Trafilatura); Engram should depend on one, not write one.

## Method
Metadata only, gathered with gh api on 2026-11-21. No benchmark was run or read.

## Key numbers
- mozilla/readability: Apache-2.0, 11,561 stars, pushed 2026-08-04, JavaScript.
- kepano/defuddle: MIT, 10,126 stars, pushed 2026-11-20, TypeScript.
- adbar/trafilatura: Apache-2.0, 7,158 stars, pushed 2026-11-20, Python.
- mixmark-io/turndown: MIT, 11,516 stars, pushed 2026-11-04, JavaScript.
- cheeriojs/cheerio: MIT, 30,552 stars; happy-dom: MIT, 4,754 stars.
- jsdom reports NOASSERTION through the API; its licence was not verified here.

## What Engram borrows
Readability or Defuddle plus a light DOM (happy-dom or cheerio) in a URL ingest tool; the fetch records final URL, HTTP validators (ETag, Last-Modified), the extractor id and version, and the raw-body hash. Lands in AB-ING-3.

## What Engram does differently
Web text is kind `external`, the lowest trust, and every bundled preset denies it until a policy opts in (ADR 0004).

## Risk to our claims
Extractors differ on which text they keep, so the same page can give two hashes. Hash both the raw body and the extracted text.

## Open question
Which extractor drops the most hidden text under Hidden-in-Plain-Text style attacks?

## Notes
A third-party listing describes Defuddle as a work in progress.

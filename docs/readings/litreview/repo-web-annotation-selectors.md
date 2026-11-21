---
id: repo-web-annotation-selectors
title: W3C Web Annotation selectors (TextQuoteSelector, TextPositionSelector)
authors: W3C Web Annotation Working Group
venue: W3C Web Annotation Data Model and Selectors and States Note
year: 2017
tier: new
topics: [provenance, ingestion, citation, source-change]
engram: [govern, plane]
code: none found (reference implementation: Apache Annotator)
sources_read: [https://www.w3.org/2014/04/annotation/slides/RobustAnchoring.pdf via search summary, https://annotator.apache.org/docs/api/modules/dom.html via search summary]
---

## Claim
A reference into a text is best stored as a quote with prefix and suffix context plus a character position hint, so it survives small edits to the source.

## Method
TextQuoteSelector holds exact text, prefix and suffix. TextPositionSelector holds start and end offsets. Matching tries the position, then falls back to the quote with context. The robust anchoring slides also propose anchor states: anchored, half-orphaned, orphaned.

## Key numbers
none stated in the sources read.

## What Engram borrows
The span locator for provenance: `{quote, prefix, suffix, start, end}` and the three anchor states, mapped to source-changed outcomes (anchored: still valid; moved: warn; orphaned: warn and hold for review). Lands in AB-ING-2 and AB-ING-4.

## What Engram does differently
The W3C model is for human annotation. Engram keeps the hash of the whole source and of the span, so a lint can say which of the two moved.

## Risk to our claims
Fuzzy re-anchoring can silently attach a memory to different text. Re-anchoring must be an event, not a quiet fix.

## Open question
Which match threshold for fuzzy re-anchoring keeps false anchors under 1% on edited-document fixtures?

## Notes
Only search summaries of the specifications were read, not the specifications. dom-anchor-text-quote (Hypothesis) is MIT but archived, last push 2022-06-02 (gh api); port the idea, do not depend on it.

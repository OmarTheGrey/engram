---
id: anthropic-components-of-agent-memory
title: "The components of agent memory (Anthropic Engineering)"
authors: Lance Martin (Anthropic)
venue: Anthropic engineering blog, 6 November 2026
year: 2026
tier: new
topics: [industry, store, harness, evaluation]
engram: [govern, distill, plane]
code: not applicable
sources_read: [https://www.anthropic.com/research/components-of-agent-memory]
---

## Claim
Agent memory is knowledge from experience that persists between sessions, organised as transcripts, notes, representations such as wikis, and injected context, and an offline "dreaming" pass that rereads transcripts to correct and restructure memory is what makes it better.

## Method
A blog post with small evaluations: CL-Bench (a database task over fresh sessions with a persistent memory directory), Pokemon Red memory-writing styles, and a corpus of about 350,000 files (about 420M tokens) where dreaming over 128 sessions builds a wiki. Weights, in-context learning and compaction are excluded from the definition.

## Key numbers
- CL-Bench, Opus 5.5: 0.655 baseline to 0.838 with memory; Sonnet 4.6: 0.330 to 0.364, to 0.641 with refined instructions.
- A fixed "record only failures" rule cost Opus 5 minus 0.234 in memory gain.
- Wiki dreaming: wiki-only score 13 to 48 percent; wiki plus search 61 against 53 for search alone, about 20,000 tokens saved per question.
- Per-contract pages with verbatim terms: 41 of 57 (72 percent) to 57 of 57.
- Claude Code loads only the first 200 lines or 25 KB of MEMORY.md.
- The post is a single-vendor blog; numbers are the vendor's and no variance is given in what was read.

## What Engram borrows
Dreaming is the strongest vendor statement of consolidation. Engram should treat a dreaming pass as a writer: its output is a derived write with provenance `compaction`, a trust ceiling of its inputs and an event, and transcripts are the ground truth against which a note can be linted ("note contradicts transcript"). The post's finding that a wrong note propagates (Pokemon ledge) is a fixture for a staleness lint.

## What Engram does differently
The post has no permissions, enforcement or audit; it states dreaming is self-correction, not external control. Engram's claim is exactly that gap.

## Risk to our claims
The post says telling the model what memory is for beats prescribing rules, which argues for instruction-style steering over enforcement for utility. That concerns utility, not safety; H1 measures violation, but H2 must show the governance tax is not larger than what better steering would recover.

## Open question
Can a dreaming pass run under the plane so each rewrite is a logged supersession, and does that keep its gains?

## Notes
The post says it does not discuss access controls, permissions or policy governance (as read). Model names in the post (Opus 5, Fable 5, Sonnet 5) were taken as written and not independently checked.

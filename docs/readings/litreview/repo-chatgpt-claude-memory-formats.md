---
id: repo-chatgpt-claude-memory-formats
title: ChatGPT data export and Claude memory import and export formats
authors: OpenAI help pages and community write-ups; Anthropic support pages
venue: product documentation, read 2026-11-21
year: 2026
tier: new
topics: [import, export, twin, provenance]
engram: [twin, govern, plane]
code: none found
sources_read: [https://difegam.github.io/chatgpt-to-markdown/explanation/export-format, https://support.claude.com/en/articles/12123587-importing-and-exporting-your-memory, web search results on the ChatGPT export]
---

## Claim
Neither vendor publishes a memory interchange schema. ChatGPT exports conversations as a ZIP of JSON and Claude moves memory as pasted text, so an Engram bridge must parse a de facto format and record that it did.

## Method
Per a third-party converter's description of the ChatGPT export: a ZIP with `conversations-NNN.json` partitions (an array of conversations; each has a `mapping` DAG of nodes whose root has `parent: null` and `message: null`, and a pointer to the current node), `export_manifest.json` (`export_files` with `path` and `size_bytes`), `user.json`, `user_settings.json`, `message_feedback.json` and `chat.html`. The page names no memory file. One web source says memory entries are included and another says they are not, and neither was confirmed against OpenAI's pages. Anthropic's support page: import is pasted text, one entry per line as the date saved if available then the memory, extracted into entries the user reviews; export is Settings, Manage, or asking Claude to write memories out verbatim; there is no file schema or API; imports are called experimental.

## Key numbers
None stated in the sources read.

## What Engram borrows
- The line format "date, then memory" is trivial to parse and carries a date that becomes `valid_from`.
- Imported rows enter with provenance kind `import` (or `external`) and status candidate, so the write gate and review decide, never the importer.

## What Engram does differently
The vendors' import extracts and merges silently. Engram's bridge would keep each source line as an item with a content hash of the line, so an import is reproducible.

## Risk to our claims
The ChatGPT format has changed (a single `conversations.json` became numbered partitions, per a community report). A parser must be versioned and fail closed on an unknown shape. Exports hold personal data, and AGENTS.md rule 12 forbids committing real ones, so fixtures must be synthetic.

## Open question
Do ChatGPT exports include saved memories today? The conflicting claims need a real export to settle.

## Notes
The converter page does not document message fields (`author.role`, `content.parts`), so the parser plan must read a real export locally.

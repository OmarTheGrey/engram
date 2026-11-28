---
date: 2026-11-28
author: claude-agent
type: decision
card: L9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/evidence.ts
  - packages/core/src/lint/model.ts
supersedes: none
---

**What.** Three settings of the check: a quote is matched against the item's whole text with every whitespace run, line breaks included, folded to one space; a failed flag is a new judgment outcome, `ungrounded`; a grounded request has a 512-token limit, against 256 for the plain one.

**Why.** The source matches one line of a note and refuses a quote across lines; an item has no lines, and the card says whitespace folding. A separate outcome keeps the model's verdict readable beside the check's result, as the card asks for "a judgment that is not a finding", and keeps malformed for replies that do not parse. The grounded reply carries up to two quotes beside the reason; a truncated reply would read as malformed.

**Result.** All three tested; none applies with the option absent.

**Consequence.** The token limit is an untuned choice for an unregistered variant.

---
id: repo-claude-memory-controls
title: Claude memory, project scoping, incognito and organisation controls
authors: Anthropic (support documentation)
venue: Anthropic Help Center, read 2026-11-21
year: 2026
tier: new
topics: [governance, competitor, twin, retention, provenance]
engram: [twin, govern, plane]
code: none found
sources_read: [https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context]
---

## Claim
Claude's memory is a set of editable topics with per-project scoping, per-chat opt-out, incognito chats, import and export, and org-level switches, while owners cannot view or edit individual members' memories and member memory edits are not logged.

## Method
Help-center article read in full. Each project has its own memory; inside a project Claude uses that project plus non-project memory, never other projects; "Use account memory" can be turned off per project. Owners toggle memory org-wide and cannot enable it per user. Org custom retention applies to memory except project memory. Deleting a conversation does not delete memory derived from it. Sensitive topics are a separate per-user opt-in.

## Key numbers
none stated in the sources read.

## What Engram borrows
Per-project memory as a scope kind with an explicit inherit-account flag, per-write opt-out (incognito) as a policy-visible source flag, sensitive-topic opt-in as a policy class, pause versus reset as two distinct lifecycle operations (card AB-CMPT-5).

## What Engram does differently
Engram logs member-level changes with reasons and lets a grant holder inspect and explain each memory; the Claude page states individual member edits are not logged.

## Risk to our claims
The consumer feature set moves quickly and the page carries conflicting rollout text for Team and Enterprise. Recheck before the deck.

## Open question
Should pause and reset be two Plane operations with distinct events in the twin profile?

## Notes
Import and export are described as experimental. Enterprise audit covers org-level memory toggles only. See also the existing note claude-code-auto-memory.

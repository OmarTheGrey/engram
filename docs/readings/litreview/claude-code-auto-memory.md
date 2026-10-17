---
id: claude-code-auto-memory
title: "Claude Code auto memory and auto dream (official documentation and reporting)"
authors: Anthropic (documentation); Paul Sawers, Tessl (reporting on auto dream)
venue: Vendor documentation at code.claude.com, read 2026-10-17; Tessl article 26 March 2026
year: 2026
tier: new
topics: [store, governance, methods]
engram: [plane, H4, H1]
code: Claude Code itself is closed; the behaviours below are documented, not inspected
sources_read: [https://code.claude.com/docs/en/memory, https://tessl.io/blog/anthropic-tests-auto-dream-to-clean-up-claudes-memory]
---

## Claim
The most widely deployed coding-agent memory is two markdown mechanisms with no policy layer: user-written CLAUDE.md files loaded by scope, and model-written auto memory loaded from a per-repository `MEMORY.md` index capped at 200 lines or 25KB. The documentation says both are "context, not enforced configuration" and tells users to use a PreToolUse hook to block anything. Consolidation of auto memory ("auto dream") is reported as an unreleased background pass that merges, prunes and normalises memory files between sessions.

## Method
This is a documentation read, not an experiment. CLAUDE.md scopes, in load order: managed policy (`/etc/claude-code/CLAUDE.md` on Linux, or the `claudeMd` key in `managed-settings.json`), user (`~/.claude/CLAUDE.md`), project, local, plus `.claude/rules/` files that can be path-scoped with a `paths` frontmatter field and load on Read, Write or Edit of a matching file. Auto memory lives at `~/.claude/projects/<project>/memory/` with a `MEMORY.md` index and one topic file per memory; the project key is derived from the git repository so all worktrees share one directory; it is machine-local and excluded from the `cleanupPeriodDays` transcript sweep. Claude records four note types in frontmatter, `user`, `feedback`, `project`, `reference`, and is told to skip anything derivable from the codebase or already in CLAUDE.md. The first 200 lines or 25KB of `MEMORY.md` load every session; a write past the limit succeeds but returns an error telling Claude to rewrite the index. Controls: a `/memory` toggle writing `autoMemoryEnabled` to user settings, a per-project `autoMemoryEnabled: false`, `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, and `autoMemoryDirectory` honoured under the same workspace-trust rule as hooks; with `permissions.blockReadsOutsideWorkingDirectories` on, no auto memory loads from a repository-chosen directory. Subagents do not inherit the main conversation's auto memory unless forked. Project-root CLAUDE.md is re-read from disk after `/compact`. The Tessl article (26 March 2026) reports, from community posts on v2.1.83, an "auto dream" toggle under `/memory` that reviews memory files, merges overlapping entries, removes outdated or conflicting ones, converts relative timestamps to fixed dates and rebuilds the index, running only after usage and elapsed-time thresholds; no official changelog or thresholds are cited.

## Key numbers
- `MEMORY.md` read limit: first 200 lines or 25KB, whichever first; CLAUDE.md loaded up to 4 MiB in full, larger files skipped; recommended CLAUDE.md size under 200 lines (memory docs, "Auto memory" and "Troubleshoot" sections).
- Auto memory added February 2026; auto dream references in Claude Code v2.1.83; no performance figures or trigger thresholds given (Tessl, 26 March 2026).
- Managed policy CLAUDE.md cannot be excluded by `claudeMdExcludes` (memory docs, "Managed policy").

## What Engram borrows
The scope ladder, managed then user then project then local then path-scoped rules, is a working precedent for ADR 0006's org, team, role, person ordering, with the detail that the org layer is the one that cannot be excluded. The four auto-memory note types are a small, deployed class taxonomy that Engram's `class` and provenance kind should map to in the H4 files adapter (ADR 0013): `feedback` is a user-kind correction, `project` is semantic, `reference` is a pointer. The documented 200-line cap with a rewrite-on-overflow error is a retention budget (ADR 0010) implemented as a prompt instruction, which is precisely the H1 "instruction" condition for retention. The rule that auto memory loads only from trusted directories under workspace trust is the no-bypass concern of ADR 0014 seen from the harness side, and the fact that compaction re-reads CLAUDE.md from disk but not conversation-only instructions is a concrete faithfulness-under-compaction behaviour to test in S0.5 and E8.4.

## What Engram does differently
Claude Code's own documentation says memory is context, not enforcement, and points at hooks for anything that must hold; Engram is that hook layer, generalised: scope and grants are checked before the read, provenance is set by the plane, and every load or skip is an event. Auto dream, as reported, is a model-written consolidation with no lineage; Engram's lints emit events and a merge is a new version with `lineage` (ADR 0005, 0008). Claude Code's auto memory is per repository and machine-local; Engram's scopes are per principal and can be shared under grants.

## Risk to our claims
ADR 0022 says Claude Code hooks can block tool calls but cannot transform context. If auto memory and CLAUDE.md are injected by the harness before any hook sees them, the H4 "governed tools without read filtering" condition on Claude Code cannot govern the harness's own memory at all, only Engram's tools. The thesis must state that scope: on Claude Code, Engram governs what it stores, and the harness's auto memory is an ungoverned channel that the files adapter can at most lint after the fact.

## Open question
Auto dream, if shipped, rewrites `MEMORY.md` in the background with no record of what was merged or dropped. Can the files adapter (A3) detect a dream pass by hashing memory files between sessions and emit a `compaction`-kind event with the diff, so the source-changed lint has something to compare?

## Notes
Documentation is undated and changes; the read was on 2026-10-17 and the settings names quoted (`autoMemoryEnabled`, `autoMemoryDirectory`, `CLAUDE_CODE_DISABLE_AUTO_MEMORY`, `cleanupPeriodDays`, `claudeMdExcludes`, `permissions.blockReadsOutsideWorkingDirectories`) should be re-checked when E8.4 is worked. The Tessl article cites Reddit threads and a quote from Anthropic staff member Thariq Shihipar; treat auto dream as reported, not released. Mem0's harness comparison (Aug 2026) and the Letta issue #3320 proposing policy enforcement on memory reads and writes via a governance toolkit were also read for this sweep and found too thin to note separately; the Letta issue had no maintainer response in the text read.

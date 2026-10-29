# ADR 0028: The Letta adapter works over MemFS, Letta's git-backed context repository, on local disk

Status: accepted, pending lead review, 2026-10-29
Deciders: drafted by the orchestrating session on the lead's instruction (plan `docs/tasks/gate-b-plan.md`, decision 2); pending review and acceptance by Omar (lead). Until then this records the design card A2 follows.
Supersedes: the sentence of ADR 0013 "Letta through `@letta-ai/letta-client`" (amended there to point here).

## Context

Gate B needs two adapters passing the conformance suite and denying a cross-scope read with the same event; the roadmap's second store is Letta. ADR 0013 named Letta's server client, but card A2 names Letta's "git-backed context files: items as files with frontmatter, search by index", and a commit per write. A Letta server needs its own Postgres and is run from a container image or a hosted account; the lead's no-Docker instruction (2026-10-29) excludes the first, and a hosted account would send test content off the machine. Letta Code's memory, MemFS (its context repositories), is a git repository of Markdown files with YAML frontmatter (`name`, `description`), a `MEMORY.md` index per directory, the root's files loaded into every prompt and a directory with its own `MEMORY.md` loaded on demand; every memory edit is a commit, and a local-only agent commits to a repository on the machine.

## Decision

1. The Letta adapter (`packages/adapters/src/letta/`) works over a MemFS repository on local disk. It opens an existing repository or initialises one in an empty folder, and refuses anything else.
2. Engram's items are files in an `engram/` directory with its own `MEMORY.md`, so they are listed in the root index but not loaded into every Letta prompt. Each file carries Letta's frontmatter (`name`, `description`) and Engram's item fields; the conformance suite's fidelity rules apply in full.
3. One commit per write and per delete, touching only the item's file and the index, with the repository's own identity and hooks; a failed commit restores the working tree. No network operation is ever run.
4. `search` uses the adapter's own lexical index of those files (`native_search: false`: MemFS has no search of its own, its search is an optional mod); `history` reads git (`native_history: true`).
5. Git is reached through the `git` executable; no new npm dependency. `engram doctor` checks it.

## Alternatives considered

- The Letta server through `@letta-ai/letta-client` (ADR 0013's wording): needs Docker or a hosted account; the card already pointed away from it.
- Writing items at the repository root: every item would enter every Letta prompt, which a store adapter must not decide for the agent.
- isomorphic-git: a pure-JavaScript git, but a large dependency for four commands the `git` executable already provides on every development machine and CI image.

## Consequences

A2 runs offline in the conformance suite on Windows and Linux. Engram governs what it writes into a Letta agent's memory; Letta's own files (`persona.md` and the like) are adopted later, as A3 did for Claude Code memory. A `git` command a model runs inside the repository is a bypass the pi extension's store-name check does not see; the path check covers pi's file tools. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- Letta documentation, MemFS: https://docs.letta.com/letta-code/memfs (read 2026-10-29)
- `docs/tasks/A2.md`, `docs/decisions/0013-adapter-contract-and-conformance.md`
- `docs/decisions/0019-monorepo-tooling.md` (the no-Docker amendment)

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

Amendments made by card A2, 2026-10-29 (Gate B plan PR 2, branch `gb-pr2-letta`; the choices this ADR left open, pending the lead's review like the rest of it):

- Opening. `createLettaAdapter({ root })` is asynchronous: it resolves the folder before any write. A missing or empty folder is initialised with `git init`; an existing repository is opened only at its top level and only when it is not bare; a non-empty folder that is not a repository, a folder inside another repository's tree, a symlinked root and a symlinked `.git` are refused.
- Setup. When `engram/MEMORY.md` or the root `MEMORY.md` line is missing, opening adds it in one setup commit of its own (message `engram: list engram/ in MEMORY.md`), so every later commit is one write or one delete. The root line is `- [engram/](engram/MEMORY.md) - ...`, appended with the file's own line ending; nothing else in the root `MEMORY.md` changes. Indexes carry no frontmatter (Letta's documentation exempts `MEMORY.md`).
- Item file. Letta's `name` is the memory's label, `engram/<id>` (Letta projects a label to `<label>.md`); `description` is the content's first line (at most 60 code points) with class, scope and version. Every other item field sits under one key, `engram`, as in the files adapter (ADR 0013). The engram/MEMORY.md line is `- [<id>.md](<id>.md) - <description>`; the status is in neither, so a status-only rewrite changes the item file alone.
- Bytes. Item files and the index are LF only. Content holding a carriage return or a lone surrogate is stored as JSON, which escapes both, so no line-ending conversion git applies on add or checkout (`core.autocrlf`, `.gitattributes` `text`) can change a stored item; a file read back with CRLF line ends is read as LF. Every write is parsed back before it is stored and refused unless every field round-trips exactly. `core.autocrlf` is not overridden (it never touches an LF-only file on add); `core.safecrlf=false` is passed per command so an LF-only file is never refused. History reads raw blobs (`git cat-file --batch`, no filters), so a filter attribute such as Git LFS on `engram/*.md` would show its pointer, not the item: not supported, and never a network call.
- Commits. A write runs `git add --all --force` then `git commit -- <item file> engram/MEMORY.md`: only those two paths are committed, whatever else the user staged, and `--force` keeps a `.gitignore` from dropping an item. Rewriting identical bytes makes no commit, and deleting an absent item makes none. The message names the item id, class, scope and version, never content. Hooks are never bypassed; a hook that rewrites the file it commits is not detected.
- Identity. For each of name and email separately, when no git configuration level sets `user.name` (or `user.email`) and the environment sets no `GIT_AUTHOR_*` or `GIT_COMMITTER_*` value for it, the adapter supplies `Engram` (or `engram@localhost`) through those variables. Read once at open.
- All or nothing. When the add or the commit fails, the item file and the index are put back byte for byte (or removed) and the two paths unstaged with `git reset -- <paths>`; a failed restore is reported with both errors.
- Keys and paths. A key is exactly `engram/<lowercase UUID>.md` and a written id must be a lowercase UUID, so no key reaches `.git`, the root files, a subfolder or outside the repository. `engram/` must be a real directory (a symlink or junction is refused) and every file read or replaced must be a regular file with one name (a hard link is refused), checked on the path and on the opened handle, as the files adapter does. A file in `engram/` not named `<uuid>.md` is ignored, not listed and not reported.
- Lock. Writes and deletes are serialised in the instance and hold `engram.lock` in the repository's git directory (outside the working tree, so no `git status` shows it), with the files adapter's rules, now shared in `packages/adapters/src/lock.ts`. Letta's own git client is not serialised by it; git's `index.lock` refuses one of two simultaneous commits, and the refused write is restored whole. Every git call runs with `GIT_TERMINAL_PROMPT=0`, `GIT_OPTIONAL_LOCKS=0`, no shell and a 60 s timeout.
- Search and history. `search` scans `engram/` at query time and matches every term over the content, like the files adapter; there is no persisted index file, since one would be another file to commit. `history` is `git log --reverse` over the item's path, each version read from its blob; consecutive identical versions are collapsed, and versions stay readable after a delete.
- Doctor. `engram doctor`'s letta check runs `git --version`, then writes and reads a probe through a plane in a temporary repository, checks one version in git, and deletes it. The delete is the one direct adapter call outside the adapter's tests: the plane has no delete (hard deletion waits for person-scope erasure), and the repository is doctor's own temporary folder.

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

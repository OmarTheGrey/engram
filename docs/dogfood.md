# Dogfood record

Each member's own Claude Code memory, read through the plane with `engram read` (roadmap, phase 0: "every member's Claude Code memory visible through `engram read`"; Gate A's fourth criterion). Counts only: no memory content, file name, path or query leaves the member's machine (AGENTS.md rule 12). A row is added by the member who ran the command, in a PR of its own or with a log entry naming it.

| date | member | memories listed | adopted | denied | items returned | filtered | preset | source |
|---|---|---|---|---|---|---|---|---|
| 2026-10-25 | Omar (lead) | 2 | 2 | 0 | 2 | 0 | medium | `docs/log/2026-10-25-e8-2-cli-read-write-doctor.md` |
| | member 2 | | | | | | medium | |
| | member 3 | | | | | | medium | |
| | member 4 | | | | | | medium | |

How the columns are read from the command's output: `imported N of M memories: A allowed, D denied, U already in the log` gives memories listed (M), adopted (A) and denied (D); `K items returned, F filtered` gives the last two. The owner's denied count is listed minus adopted, since the log entry records 2 listed and 2 adopted. The member rows are placeholders until each member puts their name in.

## The step for each member

A human step: only the member can run it, on their own machine, against their own folder. From a clone of this repository, after `pnpm install`:

```
node packages/cli/src/main.ts read --root "<your Claude Code memory folder>" --owner <your id> --db :memory:
```

- The memory folder is the `memory` folder of a project under `~/.claude/projects/` (on Windows `%USERPROFILE%\.claude\projects\<project>\memory`); `<your id>` is a short name such as `omar`, and the memories are adopted as `person:<your id>`.
- `--db :memory:` keeps the event log in memory, so nothing about the memories is written to disk by the run. `make engram ARGS="read --root <folder> --owner <id> --db :memory:"` is the same command through the Makefile.
- Copy the two count lines into the table above; never the items the command prints. Add the date you ran it and the preset (`medium` unless you passed `--policy`).

# Dogfood

Two records, both counts only: no memory content, file name, path, item id or query leaves a member's machine (AGENTS.md rule 12; rule 7 of `docs/conventions/documentation.md`).

1. **The twin dogfood (card E9.5)**: each member runs a twin over their own Claude Code memory for two weeks, then runs the violation report and sends the team its counts. Gate D asks that the Knowledge and Twin profiles "run on dogfood data with zero recorded violations" (`docs/roadmap.md`).
2. **The Gate A record**: each member's Claude Code memory read through the plane once with `engram read` (below the twin dogfood).

## The twin dogfood (card E9.5)

Status: the kit is ready (this procedure and `packages/core/scripts/dogfood-report.ts`). The two weeks have not started: they start on the lead's go, after card E2.6 merges.

Who: Omar, Mohamad and Shady, each on their own machine (`docs/log/2026-11-19-lead-decision-twin-dogfood.md`). Each member is `person:<id>`, with `<id>` one of `omar`, `mohamad`, `shady`.

What runs: `engram serve` under the twin profile (`packages/pi-package/profiles/twin.yaml`, ADR 0021), over the files adapter on the member's own Claude Code memory folder, with one SQLite event log kept for the dogfood alone. Claude Code reaches it through `engram mcp`, the member through the inspector and the CLI. Every other process talks to the server; none opens the log itself.

### When it starts

- On the lead's go, after card E2.6 merges. E2.6 closes a race between two processes writing one log (ADR 0034, decision 5; ADR 0007, decision N2). Until it lands, a write from a second process can interleave with another and leave erased or ungranted content readable, which the report would count as a violation no member caused. The lead's go is logged as a `milestone` entry, naming the commit of main everyone starts from.
- All three start the same day from that commit (`git rev-parse HEAD` prints it), and run for fourteen days.

### What you will meet: the known limits

Read these before you start, so they do not surprise you.

1. **Claude Code's own memory files cannot be granted.** The files adapter holds a memory file Claude Code wrote read only, so a grant on one is refused and recorded (`engram/write/store-failure`). You can grant only items written through Engram (ADR 0034, consequences; backlog row "Granting Claude Code's own memories").
2. **A grantee's API read shows every grant on the item.** The inspector shows a viewer who is not the owner only the grants that name it, but `POST /api/v1/read` returns them all, so a grantee reading through the CLI or the API learns who else may read the item (ADR 0034, decision 9).
3. **Model content carries no grants.** What the agent writes through MCP is source `model`, and a grant on it is refused (`engram/write/grant`).
4. **Every item written through Engram is adopted again once, as `import`,** on the next read (one more write event per item; backlog row "Re-adoption of plane writes"). For an item the agent wrote, that re-adoption raises its provenance from `model` to `import`, and the gate then accepts a grant on it. **Do not grant an item the agent wrote.** The report counts such grants under `watch.granted_after_raise`; they are not violations by the report's two kinds, and the lead decides how to read them (backlog row "Re-adoption raises model content to import").
5. **Identity is self-asserted.** There is no authentication (ADR 0027): `--as` and `--member` are taken as given, and the log records only an actor's id. The report therefore judges your reads under the flags you declare to it, so give `engram serve`, `engram mcp` and the report the same `--as` and `--member` for the whole two weeks.
6. **A grant acts on your own log only.** A teammate cannot read your items from their machine. To see a grant work, read as the grantee on your own machine (`--as person:<teammate>`); the report judges that principal as the CLI builds it from `--as` alone (its own person scope).

### Setup, once

1. A clone of this repository at the agreed commit, then `pnpm install && uv sync`. Node 24 or later (`node packages/cli/src/main.ts doctor` checks it).
2. Build the inspector: `make ui`.
3. Your memory folder: the `memory` folder of the project you work in most, under `~/.claude/projects/` (on Windows `%USERPROFILE%\.claude\projects\<project>\memory`). Copy it somewhere private as a backup before you start: the plane writes the items you create through Engram into it as `<id>.md` files.
4. Your log: the per-user default, `~/.engram/engram.db` (on Windows `%USERPROFILE%\.engram\engram.db`), outside the repository and the memory folder. If one is there already, rename it before the start, so the dogfood's log holds the two weeks and nothing else. The default matters: it is the log `engram serve` opens, the one the Claude Code hook protects from file tools (a command given `--server` takes no `--db`), and the one the report reads. Leave `ENGRAM_DB_URL` unset.

Below, `<folder>` is your memory folder, `<id>` your id, and `<repo>` the absolute path of your clone. Quote paths that hold spaces.

### Start the server, each working day

From the clone:

```
node packages/cli/src/main.ts serve --root "<folder>" --owner <id> --policy packages/pi-package/profiles/twin.yaml --as person:<id> --member person:<id>
```

It prints `engram serve: listening on http://127.0.0.1:7313 (log <home>/.engram/engram.db, ..., store files at <folder>, viewer person:<id>)` and runs until you stop it with Ctrl+C. It listens on loopback only. The first run creates the log. Use the same flags every day; add no `--member` beyond your person scope unless the team agreed it before the start.

### Connect Claude Code, once

In the project you work in, `.mcp.json` (the shape of `fixtures/harness/claude-code/.mcp.json`):

```json
{
  "mcpServers": {
    "engram": {
      "command": "node",
      "args": ["<repo>/packages/cli/src/main.ts", "mcp", "--server", "http://127.0.0.1:7313",
               "--as", "person:<id>", "--member", "person:<id>"]
    }
  }
}
```

and `.claude/settings.json`, the no-bypass hook (the shape of `fixtures/harness/claude-code/.claude/settings.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": ["<repo>/packages/cli/src/main.ts", "hook", "claude-code", "--root", "<folder>",
                     "--as", "person:<id>", "--server", "http://127.0.0.1:7313"]
          }
        ]
      }
    ]
  }
}
```

Restart Claude Code. Its memory now goes through the Engram tools, which the plane gates (source `model`, into `person:<id>`); the hook blocks a shell command naming a store and a file tool inside `<folder>`, and records each block. The memory files Claude Code wrote before the start stay where they are, adopted read only.

Pi is optional. The Engram pi package reads `ENGRAM_ROOT=<folder>`, `ENGRAM_OWNER=<id>`, `ENGRAM_AS=person:<id>`, `ENGRAM_MEMBER=person:<id>` and `ENGRAM_POLICY=<repo>/packages/pi-package/profiles/twin.yaml`. It opens the default log in its own process beside the server, which is the case card E2.6 makes safe, so use it only once E2.6 has merged.

### Each day

- Work as usual in Claude Code. Its memories are written through the plane.
- Write at least one item yourself, as a user:

  ```
  node packages/cli/src/main.ts write --server http://127.0.0.1:7313 --as person:<id> --member person:<id> --scope person:<id> --class semantic --content "<something you want remembered>"
  ```

- Open the inspector at `http://127.0.0.1:7313/`: your person lane, each item's grants, the timeline of decisions.
- A few times a week, in the inspector's grants editor, grant an item **you wrote** to a teammate's principal (`person:<teammate>`), of the item's class, with an expiry inside the two weeks. Later remove one grant, and let another expire.
- Read as that teammate on your own machine, to see the grant admit and, after its removal or expiry, refuse:

  ```
  node packages/cli/src/main.ts read --server http://127.0.0.1:7313 --as person:<teammate>
  ```

- Keep any notes about what surprised you private; what goes to the team is counts.

### Never

- **Never bypass the plane.** Do not write, edit, move or delete anything in `<folder>` or in `~/.engram/` by hand, by script or by an agent's tool. While the server runs, give every other `engram` command `--server http://127.0.0.1:7313` (or `--db :memory:` for anything unrelated): a second `engram serve`, an `engram mcp` without `--server`, or any command left on the default log opens the log in another process.
- **Never commit or send content.** Not a memory, a file name, an item id, a query, a grant's principal, the log, a screenshot of the inspector, or the report's `--detail` lines. Only the report's standard output leaves your machine.
- Never change `packages/pi-package/profiles/twin.yaml`, the flags, or the commit mid-run. If you have to, tell the team the day it happened; the report judges the whole log under one policy and one set of flags.
- Never grant an item the agent wrote (limit 4).

### At the end: the report

Stop the server (Ctrl+C), then, from the clone:

```
node packages/core/scripts/dogfood-report.ts --as person:<id> --member person:<id> > twin-dogfood-<id>.json
```

(`make dogfood-report ARGS="--as person:<id> --member person:<id>"` is the same.) `--policy` defaults to the twin profile and `--db` to the default log, as for the CLI (`--db <path>` names another SQLite log). It only reads the log. Exit 0: no violation; 1: one or more; 2: it could not read the log or a flag.

It replays your log through the invariants' oracle (`packages/core/src/oracle.ts`, the one `make test-invariants` judges the plane with), never the plane's own evaluator, and prints:

| key | what it counts |
|---|---|
| `events`, `days_with_events`, `span_days`, `by_op` | the events, the days with one, the days from the first to the last, and events by operation and decision |
| `reads` | read events (`as_declared`: by your actor; `as_others`: by any other principal), items returned, and items returned only through a grant |
| `writes` | write events allowed and denied (adoptions included) |
| `grants` | allowed events that changed what an item's grants admit, and the grants they added and removed |
| `denials` | denied events by rule id (a rule id of another shape counts as `other`); `asks`; `bypass_blocked` |
| `violations` | `read`: a read that returned an item you (or the principal who read) could not read at that time under the twin profile: missing, not active, or outside the reader's scope and live grants; `grant_change`: an allowed event that changed what an item's grants admit and was not its owner's grant change or the owner's own user- or import-sourced write; `total` |
| `watch` | not violations, counted for the lead: `provenance_raised` (an item's provenance raised from model, compaction or external to a trusted kind, as re-adoption does) and `granted_after_raise` (grants added to such an item) |
| `policy_sha256`, `report` | the hash of the policy the log was judged under, and the report's format |

If `violations.total` is not zero, run the command again with `--detail`: it names each violation's event and item on standard error, for you alone. Tell the team the counts and the rule ids involved, never the ids or content; the team logs each violation as a `failure` entry.

### What to send the team

The file `twin-dogfood-<id>.json`, nothing else. It holds counts, rule ids and the policy's hash, and is safe to commit; the three `policy_sha256` values must be equal. The lead commits the three files under `docs/dogfood/twin/` in one PR with a `milestone` entry for the end of the dogfood and a row each in the table below, which Gate D reads.

| member | start | days with events | reads | items via grant | grants added | grants removed | denials | violations | watch, granted after raise | report |
|---|---|---|---|---|---|---|---|---|---|---|
| Omar | | | | | | | | | | |
| Mohamad | | | | | | | | | | |
| Shady | | | | | | | | | | |

Gate D also names the Knowledge profile's dogfood, which no card covers yet (`docs/log/2026-11-19-e9-5-finding-knowledge-dogfood-uncovered.md`; backlog row "Knowledge profile dogfood"). The lead decides.

## The Gate A record: Claude Code memory through `engram read`

Each member's own Claude Code memory, read through the plane with `engram read` (roadmap, phase 0: "every member's Claude Code memory visible through `engram read`"; Gate A's fourth criterion). A row is added by the member who ran the command, in a PR of its own or with a log entry naming it.

| date | member | memories listed | adopted | denied | items returned | filtered | preset | source |
|---|---|---|---|---|---|---|---|---|
| 2026-10-25 | Omar (lead) | 2 | 2 | 0 | 2 | 0 | medium | `docs/log/2026-10-25-e8-2-cli-read-write-doctor.md` |
| | member 2 | | | | | | medium | |
| | member 3 | | | | | | medium | |
| | member 4 | | | | | | medium | |

How the columns are read from the command's output: `imported N of M memories: A allowed, D denied, U already in the log` gives memories listed (M), adopted (A) and denied (D); `K items returned, F filtered` gives the last two. The owner's denied count is listed minus adopted, since the log entry records 2 listed and 2 adopted. The member rows are placeholders until each member puts their name in.

### The step for each member

A human step: only the member can run it, on their own machine, against their own folder. From a clone of this repository, after `pnpm install`:

```
node packages/cli/src/main.ts read --root "<your Claude Code memory folder>" --owner <your id> --db :memory:
```

- The memory folder is the `memory` folder of a project under `~/.claude/projects/` (on Windows `%USERPROFILE%\.claude\projects\<project>\memory`); `<your id>` is a short name such as `omar`, and the memories are adopted as `person:<your id>`.
- `--db :memory:` keeps the event log in memory, so nothing about the memories is written to disk by the run. `make engram ARGS="read --root <folder> --owner <id> --db :memory:"` is the same command through the Makefile.
- Copy the two count lines into the table above; never the items the command prints. Add the date you ran it and the preset (`medium` unless you passed `--policy`).

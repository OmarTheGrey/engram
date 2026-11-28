// The command table: the help snapshot (card E8.2's acceptance names one) and
// unknown commands.
import { describe, expect, it } from "vitest";
import { cli } from "./helpers.ts";

const HELP = `engram: the Engram control plane from the command line; engram tui opens the terminal interface

usage: engram <command> [options]

commands:
  read [query]      read through the plane and explain every returned item
  read --item <id>  read one item by its id and explain it, if the actor may read it
  write             write one item through the plane's write gate
  check             the decision a write would get now: nothing stored, no event
  promote <itemId>  promote an item through the plane's promotion gate
  supersede <itemId>  propose end dates for the versions an item supersedes; apply accepted ones
  grants <itemId>   add or remove grants on an item, as its owner
  explain <readId>  the explanations a read recorded
  events            the events the actor may see, each with its decision, rule and reason
  retain            sweep one scope's retention: expired items retired, budgets enforced
  lint              run the policy's deterministic lints over a scope, each finding with its reason
  simulate          replay a recorded workload under the policy and a candidate; compare them
  policy            the policy the workspace decides with, and its label
  export            write the actor's memories as a bundle (docs/bundle.md), optionally encrypted
  import <bundle>   bring a bundle, or a pasted Claude memory list, in as candidates
  who-can-read      who can read an item or a scope, each reader with the rule or grant admitting it
  scopes            the scopes the actor can see, by membership or through a grant
  serve             serve the HTTP API to authenticated callers, or on loopback with --insecure-loopback
  mcp               the MCP server for Claude Code and Codex, as one fixed actor
  hook claude-code  a Claude Code PreToolUse hook that blocks store bypasses
  hook codex        a Codex PreToolUse hook that blocks store bypasses
  hook install <harness>  merge the hook into claude-code's or codex's settings, idempotently, with a backup
  key               create, list or revoke the local API keys a server accepts
  doctor            check the log, policy, store, adapters, provider keys, pins and Node
  discover          count harness memory files outside every store root, never their content
  log verify        verify the event log's hash chain: the first broken link, or OK or UNSIGNED
  log checkpoint    record a checkpoint of the chain's head, signed with --key when given
  tui               the terminal interface; --line or ENGRAM_TUI_LINE=1 for one prompt a line

every command but doctor, serve, mcp, hook, key, log and import is one call to the
HTTP API (import makes one write call per row): in process
over the workspace its flags name, or to a running server:
  --server <url>              call engram serve at <url> (default $ENGRAM_SERVER_URL);
                              the server's own flags then name the log, policy and store;
                              $ENGRAM_TOKEN, when set, is sent as the bearer credential

store options (read, write, promote, supersede, retain, lint, import, who-can-read, serve, mcp):
  --store <name>              the store adapter: files, letta or mcp-memory (default files)
  --root <folder>             the store folder: a Claude Code memory folder (files),
                              a MemFS repository or an empty folder (letta),
                              or the MCP memory server's memory.jsonl file (mcp-memory)
  --owner <id>                the person whose folder it is; its memories are adopted as person:<id>
  --import-valid-from <iso>   valid_from for imported memories (default each file's mtime)
  --policy <preset|path>      strict, medium, permissive or a policy YAML file (default medium)
  --db <path|url>             the event log: a SQLite file, :memory: for none, or postgres://...
                              (default $ENGRAM_DB_URL, else <home>/.engram/engram.db)

actor options (read, write, promote, supersede, explain, retain, lint, export, import, who-can-read):
  --as <principal>            who acts (default person:<owner>)
  --level <level>             person, role, team or org (default the actor's own level)
  --member <scope>            a scope the actor belongs to; repeatable (default the actor's scope)
  --at <iso time>             read: the time validity windows are judged at; the read and
                              the owner's sweep run at the server's clock. Any other
                              command: refused, unless --test-clock is given in process
  --test-clock                for tests and fixtures only: --at sets the clock of an
                              in-process call that is not a read (refused with --server)

read --item options:
  --item <id>                 one item by its id instead of a query (card E8.14's route):
                              the item and its explanation if the actor may read it,
                              nothing otherwise; one read event, after the same sweep and
                              adoption as a read, with read's options and output

write options:
  --content <text>            the item's content
  --file <item.json>          a JSON item; the flags and defaults fill the fields it leaves out
  --id <uuidv7>  --scope <scope>  --class <episodic|semantic>
  --confidence <0..1>  --valid-from <iso>  --valid-to <iso>
  the plane records a write as source user by the acting principal, whatever the item claims

check options:
  the write, store and actor options above: the decision engram write would get with
  the same flags now, from the same gate; nothing is stored and no event is appended;
  the write is decided again when it is made. exit 1 on deny or ask

promote options:
  --to <scope>                the target scope: the item's own or a wider one
  --review                    approve as a reviewer: a member of the target who does not own the item;
                              or, as its owner, accept a semantic candidate in your own person scope (ADR 0049)
  the plane records the promoter as source user; exit 1 on deny, or on ask when the target needs review
  limit: the CLI does not authenticate. --as and --member are taken as given, so the
  distinct-actor and reviewer rules hold only as far as this single-user machine does;
  a promotion with --review is only as trustworthy as the machine it ran on

supersede options:
  --accept <id>               apply the proposed close of this ancestor: one write of a new
                              version through the write gate; repeatable. Without it, the plan only
  the plan names the head of the item's chain and, for each ancestor the actor may read, a
  close (valid_to set to the item's valid_from) or a review flag; nothing is retired, and an
  id with no proposed close refuses the call before anything is written; exit 1 on an
  unresolved chain or a write the gate did not allow

grants options:
  <itemId>                    the item; only its owner, user-sourced, may change its grants
  --add <to>[,class=<class>][,mode=<mode>][,expires=<iso>]
                              add a grant: who it is for (person:sam, agent:claude-code/*),
                              the class it covers, read or read_write (default read), and
                              when it expires, a UTC date or time; repeatable
  --remove <grant>            remove a grant, written as for --add, exactly as the item
                              carries it; repeatable
  with the store and actor options above; one governed change, decided by the plane
  and recorded as one event; exit 1 on deny

explain options:
  --db <path|url>  --policy <preset|path>  and --as or --owner: only the reader may explain a read

events options:
  --after <seq>               only the events with a seq above this one (default every event)
  with --db, --policy and --as or --owner: the events naming a scope the actor may read
  as a member, and those it made that name no scope; an item is shown only as a read
  would return it. The log must exist; nothing is appended

retain options:
  --scope <scope>             the scope to sweep, as a user-sourced member of it; exit 1 if refused

lint options:
  --scope <scope>             the scope to lint, as a member of it; exit 1 on a finding or if refused

who-can-read options:
  <itemId>                    the item asked about, or
  --scope <scope>             a scope, by the read matrix; answered only for one who may read
                              the item or the scope, grant holders named to the owner only;
                              exit 1 if refused

scopes options:
  with the store options above and --as, --level and --member: the member scopes the
  read matrix lets the actor's level read, and the scope of each item a read would admit
  through a live grant (card E8.14's route). It is a read: one read event, and with a
  store folder the same sweep and adoption as engram read first

simulate options:
  --workload <workload.json>  a recorded workload: {id, actors, steps} (default empty)
  --policy <preset|path>      the baseline policy (default medium)
  --candidate <preset|path>   the policy to compare it with (default the baseline)
  each policy replays the workload on a scratch log and store; the real log and store are
  never read or written, and no model is called

policy options:
  --policy <preset|path>      the policy to show (default medium)
  --server <url>              instead, the policy that server decides with
  printed as YAML a policy file may hold, under a comment naming it; --json for JSON.
  No actor is needed and the log is not opened

engram export options (the bundle format: docs/bundle.md in the repository):
  --db <path|url>  --policy <preset|path>  and --as or --owner: who exports
  --out <file>                write the bundle there (default stdout)
  --recipient <age1...>       encrypt with age to this public key; repeatable
  --passphrase-file <file>    encrypt with age and the passphrase on its first line
  the bundle holds every item of the actor's own person scope and the actor's own items
  in the other scopes the read matrix lets it read, of every status, each with its events

engram import options:
  <bundle>                    a bundle engram export wrote, plain or age encrypted
  --claude <file>             instead, a memory list Claude showed you, pasted as text;
                              each bullet, dated line or paragraph is one memory
  --scope <scope>             write every row there (default each row's own scope; for
                              --claude, the importer's person scope)
  --confidence <0..1>         --claude only: each memory's confidence (default 0.7)
  --identity <file>           an age identity file to decrypt with; repeatable
  --passphrase-file <file>    the passphrase to decrypt with, on the file's first line
  every row is a write by the import actor import:<importer>, its kind the least trusted
  of the row's claim and import (a row never raises trust), owned by the importer, a
  candidate (a retired row stays retired), with no grants and a new id; the gate decides
  each row. Files over 64 MiB are refused. A candidate becomes active only through engram promote
  --review: in your own person scope you accept it as its owner (ADR 0049); elsewhere a reviewer,
  a user-sourced member of its scope other than its owner, approves it (ADR 0026). Prints
  the id map; exit 1 if any row was denied

serve options:
  --keys <file>               accept the API keys in this key file (engram key)
  --issuer <url>              accept JWT access tokens of this issuer, with:
  --jwks <url|file>             the issuer's keys
  --subjects <file>             the actor each subject of the issuer acts as
  --audience <aud>              the audience a token must carry (default the resource URL)
  --resource <url>            the server's public URL (default http://<host>:<port>)
  --insecure-loopback         no authentication: loopback only, actors self-asserted;
                              without it or a credential flag the server refuses to start
  --host <address>            127.0.0.1 (default), ::1 or localhost; another host only with
                              credentials and an https --resource (a TLS proxy in front)
  --port <n>                  the port (default 7313)
  --as <principal>  --member <scope>  the viewer the inspector shows (default none)
  the workspace flags above; runs until stopped

mcp options:
  --as <principal>            the one actor every tool call is made as, with source model
  --member <scope>            a scope that actor belongs to; repeatable
  --level <level>             the level it reads as (default its own)
  --http <port>               serve streamable HTTP on 127.0.0.1:<port> instead of stdio;
                              it takes serve's credential flags, and then each session is
                              the actor its credential names (no --as), or --insecure-loopback
  --supersede                 also list memory_supersede: the supersession plan, and each close
                              the agent accepts written through the gate as source model (off by default)
  --server <url> or the workspace flags above, as for the other commands

hook claude-code options:
  --root <folder>             a store root file tools may not touch; repeatable
  --as <principal>            who the block events are recorded as (default agent:claude-code)
  --protect <file>            a file no tool may touch, with its -wal, -shm and -journal files;
                              repeatable; with --server, name the log engram serve writes
  --server <url> or --db and --policy, as for the other commands
  reads the hook's JSON on stdin; a block answers permissionDecision deny with the reason

log verify options (on this machine only; never --server):
  --db <path|url>             the event log (default as above); read only, nothing is migrated
  --key <public.pem>          the operator's Ed25519 public key, pinned: a checkpoint signed
                              under any other key fails; without it the verdict is at best UNSIGNED
  --checkpoint <file>         a checkpoint kept outside the log (log checkpoint --out);
                              repeatable; the log must extend it
  exit 0 OK: every check holds and a signed checkpoint, verified under the pinned key,
    covers the whole chain
  exit 1 FAILED: a check failed; the first broken link is named; or an error, such as no log
  exit 3 UNSIGNED: every check holds, but part of the chain is vouched for by no signature:
    no checkpoint, no --key, no signed checkpoint, or entries after the latest signed one
  limit: without a checkpoint held outside the database, anyone with database access can
  cut the tail or rewrite the whole chain undetected; the verdict is then UNSIGNED, never OK

log checkpoint options:
  --db <path|url>             the event log (default as above); it must exist
  --key <private.pem>         the operator's Ed25519 private key; without it the checkpoint is unsigned
  --checkpoint <file>         a checkpoint kept outside the log; repeatable; the log must extend it
  --out <file>                also write the checkpoint there, to keep outside the log
  nothing is signed unless the whole log verifies first, every earlier signature under
  this --key and every --checkpoint given; the key is the operator's to hold, and a
  signature proves only that its holder saw that head

hook codex options (card E8.17): as hook claude-code's, read the way Codex sends them:
  Bash checked as POSIX and PowerShell, apply_patch by its file headers; --root and a
  relative --db resolve against the folder Codex starts the hook in; protects the log,
  .codex/config.toml, .codex/hooks.json and those of $CODEX_HOME (default ~/.codex);
  --as defaults to agent:codex; a block answers permissionDecision deny with the reason

hook install options (card E8.17): engram hook install claude-code | codex
  --project <folder>          the project whose .claude/settings.json or .codex/hooks.json
                              takes the entry (default the current folder)
  --user                      the user's ~/.claude/settings.json or $CODEX_HOME/hooks.json instead
  --root, --protect, --as, --server or --db and --policy: written into the entry, paths absolute
  writes that one file (and its folder), keeping every other entry; an earlier engram hook
  entry is replaced, never duplicated; a changed file is backed up beside it first; a second
  run writes nothing; refuses a link or a file that is not JSON, writing nothing

key options:
  create --keys <file> --as <principal> --source <kind> --expires <iso>  [--level] [--member]...
                              a key for that actor, printed once; the file holds its hash
  list --keys <file>          every key, masked, with its actor, expiry and status
  revoke <id> --keys <file>   a key never accepted again

doctor options:
  --db <path|url>             the event log to check (default as above); doctor never creates one
  --policy <preset|path>      the policy to load and validate
  --root <folder>             a store folder: readable, and its memories adopted through the plane
                              on an in-memory log (counts only)
  --host and serve's credential flags: the bind engram serve would make; fails without
                              authentication, and beyond loopback without credentials

discover options (card E9.10; no plane call, no log opened):
  --home <folder>             the home whose .claude and .codex locations are walked (default yours)
  --project <folder>          a project walked for CLAUDE.md, AGENTS.md and rules; repeatable
                              (default the current folder)
  --root <folder>             a store root: a file inside one is not counted as outside; repeatable
  counts per harness and kind, then each file outside every root by path, size and time;
  no memory file is opened, no link followed, nothing written; existence only, not whether
  a harness read it; honours CODEX_HOME and autoMemoryDirectory in ~/.claude/settings.json

tui options (card E8.15b; docs/design/tui.md):
  --no-color  --high-contrast  --ascii  --reduced-motion  --no-mouse
                              no colour (also NO_COLOR), no hue, ASCII only, no motion, the
                              mouse left to the terminal (also ENGRAM_TUI_CONTRAST=high,
                              ENGRAM_TUI_ASCII=1, ENGRAM_TUI_MOTION=reduce, ENGRAM_TUI_MOUSE=0)
  --quiet                     do not print the session's commands on quit
  --no-saved                  neither read nor write <home>/.engram/tui.json (workspace flags only)
  --screen <name>             open on home, workspace, first-run or a command's screen
  --line                      line mode, for screen readers (card E8.15e; also ENGRAM_TUI_LINE=1)
  the store, actor and export flags and --server fill its workspace; every action runs the
  plain command it shows. Refused, exit 2, when stdout or stdin is not a terminal, CI is
  set, TERM is dumb, or with --json

export options (read, write, promote, retain, lint, serve, mcp, hook claude-code):
  --otlp <url>                send each decision as an OpenTelemetry span to this OTLP/HTTP
                              traces endpoint (default $ENGRAM_OTLP_URL; none if unset)
  --export-jsonl <file>       append each decision as one JSON span a line to <file>
                              (default $ENGRAM_EXPORT_JSONL; none if unset)
  off unless named; OTEL_* variables never turn it on. A span carries the decision, its
  rule, the actor, scopes and ids, never the memory's content (ADR 0043). In process
  only: with --server, give them to engram serve

output:
  --json                      machine-readable output
  -h, --help                  this text
`;

describe("engram help", () => {
  it("prints the help text", async () => {
    const { code, out } = await cli(["--help"]);
    expect(code).toBe(0);
    expect(out).toBe(HELP);
  });

  it("prints the help text to stderr and exits 2 with no command", async () => {
    const { code, out, err } = await cli([]);
    expect(code).toBe(2);
    expect(out).toBe("");
    expect(err).toBe(HELP);
  });
});

describe("bad input", () => {
  it("rejects an unknown command", async () => {
    const { code, err } = await cli(["frobnicate"]);
    expect(code).toBe(2);
    expect(err).toContain('unknown command "frobnicate"');
  });

  it("rejects an unknown option", async () => {
    const { code, err } = await cli(["read", "--root", ".", "--owner", "dana", "--bogus"]);
    expect(code).toBe(2);
    expect(err).toContain("--bogus");
  });

  it("rejects a level that is not a scope level", async () => {
    const { code, err } = await cli(["read", "--root", ".", "--owner", "dana", "--level", "boss"]);
    expect(code).toBe(2);
    expect(err).toContain("--level");
  });
});

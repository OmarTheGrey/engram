// The command table: the help snapshot (card E8.2's acceptance names one) and
// unknown commands.
import { describe, expect, it } from "vitest";
import { cli } from "./helpers.ts";

const HELP = `engram: the Engram control plane from the command line

usage: engram <command> [options]

commands:
  read [query]      read through the plane and explain every returned item
  write             write one item through the plane's write gate
  promote <itemId>  promote an item through the plane's promotion gate
  explain <readId>  the explanations a read recorded
  retain            sweep one scope's retention: expired items retired, budgets enforced
  lint              run the policy's deterministic lints over a scope, each finding with its reason
  simulate          replay a recorded workload under the policy and a candidate; compare them
  serve             serve the HTTP API to authenticated callers, or on loopback with --insecure-loopback
  mcp               the MCP server for Claude Code and Codex, as one fixed actor
  hook claude-code  a Claude Code PreToolUse hook that blocks store bypasses
  key               create, list or revoke the local API keys a server accepts
  doctor            check the log, policy, store, adapters, provider keys, pins and Node
  log verify        verify the event log's hash chain: the first broken link, or OK or UNSIGNED
  log checkpoint    record a checkpoint of the chain's head, signed with --key when given

every command but doctor, serve, mcp, hook, key and log is one call to the HTTP API: in process
over the workspace its flags name, or to a running server:
  --server <url>              call engram serve at <url> (default $ENGRAM_SERVER_URL);
                              the server's own flags then name the log, policy and store;
                              $ENGRAM_TOKEN, when set, is sent as the bearer credential

store options (read, write, promote, retain, lint, serve, mcp):
  --store <name>              the store adapter: files or letta (default files)
  --root <folder>             the store folder: a Claude Code memory folder (files),
                              or a MemFS repository or an empty folder (letta)
  --owner <id>                the person whose folder it is; its memories are adopted as person:<id>
  --import-valid-from <iso>   valid_from for imported memories (default each file's mtime)
  --policy <preset|path>      strict, medium, permissive or a policy YAML file (default medium)
  --db <path|url>             the event log: a SQLite file, :memory: for none, or postgres://...
                              (default $ENGRAM_DB_URL, else <home>/.engram/engram.db)

actor options (read, write, promote, explain, retain, lint):
  --as <principal>            who acts (default person:<owner>)
  --level <level>             person, role, team or org (default the actor's own level)
  --member <scope>            a scope the actor belongs to; repeatable (default the actor's scope)
  --at <iso time>             read: the time validity windows are judged at; the read and
                              the owner's sweep run at the server's clock. Any other
                              command: refused, unless --test-clock is given in process
  --test-clock                for tests and fixtures only: --at sets the clock of an
                              in-process call that is not a read (refused with --server)

write options:
  --content <text>            the item's content
  --file <item.json>          a JSON item; the flags and defaults fill the fields it leaves out
  --id <uuidv7>  --scope <scope>  --class <episodic|semantic>
  --confidence <0..1>  --valid-from <iso>  --valid-to <iso>
  the plane records a write as source user by the acting principal, whatever the item claims

promote options:
  --to <scope>                the target scope: the item's own or a wider one
  --review                    approve as a reviewer: a member of the target who does not own the item
  the plane records the promoter as source user; exit 1 on deny, or on ask when the target needs review
  limit: the CLI does not authenticate. --as and --member are taken as given, so the
  distinct-actor and reviewer rules hold only as far as this single-user machine does;
  a promotion with --review is only as trustworthy as the machine it ran on

explain options:
  --db <path|url>  --policy <preset|path>  and --as or --owner: only the reader may explain a read

retain options:
  --scope <scope>             the scope to sweep, as a user-sourced member of it; exit 1 if refused

lint options:
  --scope <scope>             the scope to lint, as a member of it; exit 1 on a finding or if refused

simulate options:
  --workload <workload.json>  a recorded workload: {id, actors, steps} (default empty)
  --policy <preset|path>      the baseline policy (default medium)
  --candidate <preset|path>   the policy to compare it with (default the baseline)
  each policy replays the workload on a scratch log and store; the real log and store are
  never read or written, and no model is called

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
  exit 1 FAILED: a check failed; the first broken link is named
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

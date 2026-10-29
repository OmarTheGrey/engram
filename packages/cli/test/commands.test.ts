// The command table: the help snapshot (card E8.2's acceptance names one), the
// commands whose cards have not landed (each still one client call, answered
// 501 naming the card), and unknown commands.
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
  lint              run the policy's lints over a scope; not implemented yet (card L1)
  simulate          replay a workload under the policy; not implemented yet (card E8.9)
  serve             serve the HTTP API on a loopback port
  mcp               the MCP server for Claude Code and Codex, as one fixed actor
  hook claude-code  a Claude Code PreToolUse hook that blocks store bypasses
  doctor            check the log, policy, store, adapters, provider keys, pins and Node

every command but doctor, serve, mcp and hook is one call to the HTTP API: in process
over the workspace its flags name, or to a running server:
  --server <url>              call engram serve at <url> (default $ENGRAM_SERVER_URL);
                              the server's own flags then name the log, policy and store

store options (read, write, promote, retain, serve, mcp):
  --store <name>              the store adapter; only files for now (default files)
  --root <folder>             the store folder, such as a Claude Code memory folder
  --owner <id>                the person whose folder it is; its memories are adopted as person:<id>
  --import-valid-from <iso>   valid_from for imported memories (default each file's mtime)
  --policy <preset|path>      strict, medium, permissive or a policy YAML file (default medium)
  --db <path|url>             the event log: a SQLite file, :memory: for none, or postgres://...
                              (default $ENGRAM_DB_URL, else <home>/.engram/engram.db)

actor options (read, write, promote, explain, retain):
  --as <principal>            who acts (default person:<owner>)
  --level <level>             person, role, team or org (default the actor's own level)
  --member <scope>            a scope the actor belongs to; repeatable (default the actor's scope)
  --at <iso time>             the time of the read or write (default now)

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

lint and simulate options:
  --scope <scope>             lint: the scope to lint (default org)
  --workload <events.json>    simulate: a recorded workload, {id, events} (default empty)

serve options:
  --host <address>            127.0.0.1 (default), ::1 or localhost; any other host is refused,
                              since the server has no authentication yet
  --port <n>                  the port (default 7313)
  --as <principal>  --member <scope>  the viewer the inspector shows (default none)
  the workspace flags above; runs until stopped

mcp options:
  --as <principal>            the one actor every tool call is made as, with source model
  --member <scope>            a scope that actor belongs to; repeatable
  --level <level>             the level it reads as (default its own)
  --http <port>               serve streamable HTTP on 127.0.0.1:<port> instead of stdio
  --server <url> or the workspace flags above, as for the other commands

hook claude-code options:
  --root <folder>             a store root file tools may not touch; repeatable
  --as <principal>            who the block events are recorded as (default agent:claude-code)
  --server <url> or --db and --policy, as for the other commands
  reads the hook's JSON on stdin; a block answers permissionDecision deny with the reason

doctor options:
  --db <path|url>             the event log to check (default as above); doctor never creates one
  --policy <preset|path>      the policy to load and validate
  --root <folder>             a store folder: readable, and its memories adopted through the plane
                              on an in-memory log (counts only)

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

describe("commands whose cards have not landed", () => {
  it.each([
    ["lint", "L1"],
    ["simulate", "E8.9"],
  ])("%s exits 2 naming card %s", async (command, card) => {
    const { code, err } = await cli([command]);
    expect(code).toBe(2);
    expect(err).toBe(`engram ${command}: not implemented yet (card ${card})\n`);
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

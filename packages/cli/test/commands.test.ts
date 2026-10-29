// The command table: the help snapshot (card E8.2's acceptance names one), the
// commands whose cards have not landed, and unknown commands.
import { describe, expect, it } from "vitest";
import { cli } from "./helpers.ts";

const HELP = `engram: the Engram control plane from the command line

usage: engram <command> [options]

commands:
  read [query]      read through the plane and explain every returned item
  write             write one item through the plane's write gate
  explain <readId>  the explanations a read recorded
  doctor            check the log, policy, store, adapters, provider keys, pins and Node
  lint              not implemented yet (card L1)
  simulate          not implemented yet (card E8.9)
  promote           not implemented yet (card E2.5)
  serve             not implemented yet (card E8.1)

store options (read, write):
  --store <name>              the store adapter; only files for now (default files)
  --root <folder>             the store folder, such as a Claude Code memory folder
  --owner <id>                the person whose folder it is; its memories are adopted as person:<id>
  --import-valid-from <iso>   valid_from for imported memories (default each file's mtime)
  --policy <preset|path>      strict, medium, permissive or a policy YAML file (default medium)
  --db <path|url>             the event log: a SQLite file, :memory: for none, or postgres://...
                              (default $ENGRAM_DB_URL, else <home>/.engram/engram.db)

actor options (read, write, explain):
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

explain options:
  --db <path|url>  --policy <preset|path>  and --as or --owner: only the reader may explain a read

doctor options:
  --db <path|url>             the event log to check (default as above); doctor never creates one
  --policy <preset|path>      the policy to load and validate
  --root <folder>             a store folder to check is readable

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
    ["promote", "E2.5"],
    ["serve", "E8.1"],
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

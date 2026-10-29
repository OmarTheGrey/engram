// The command table. `run` takes the arguments and an Io (output, working
// directory, clock) and resolves to the exit code: 0 done, 1 a denied write,
// a denied or asked promotion, a failed check or an error, 2 bad usage or a
// command whose card has not landed. The CLI calls core and adapters directly; the generated client
// (card E8.3) replaces that when it exists.
import { explainCommand, promoteCommand, readCommand, writeCommand } from "./commands.ts";
import { doctorCommand } from "./doctor.ts";
import { UsageError } from "./setup.ts";

export interface Io {
  out(text: string): void;
  err(text: string): void;
  cwd: string;
  /** The user's home folder; the default event log lives under it (decision D9). */
  home: string;
  /** The current time, ISO 8601 UTC. The CLI is a surface, so it may read the clock; core never does. */
  now(): string;
  /** A fresh UUIDv7 for every id the CLI injects into the Plane; a counter in tests. */
  newId(): string;
  /**
   * The environment: ENGRAM_DB_URL, and the provider key variables doctor
   * checks by name only, never reading a value.
   */
  env: Readonly<Record<string, string | undefined>>;
  /** The running Node version, as in process.versions.node. */
  nodeVersion: string;
  /** The repository checkout the CLI runs from, for doctor's pin checks; undefined outside one. */
  repo: string | undefined;
}

export const HELP = `engram: the Engram control plane from the command line

usage: engram <command> [options]

commands:
  read [query]      read through the plane and explain every returned item
  write             write one item through the plane's write gate
  promote <itemId>  promote an item through the plane's promotion gate
  explain <readId>  the explanations a read recorded
  doctor            check the log, policy, store, adapters, provider keys, pins and Node
  lint              not implemented yet (card L1)
  simulate          not implemented yet (card E8.9)
  serve             not implemented yet (card E8.1)

store options (read, write, promote):
  --store <name>              the store adapter; only files for now (default files)
  --root <folder>             the store folder, such as a Claude Code memory folder
  --owner <id>                the person whose folder it is; its memories are adopted as person:<id>
  --import-valid-from <iso>   valid_from for imported memories (default each file's mtime)
  --policy <preset|path>      strict, medium, permissive or a policy YAML file (default medium)
  --db <path|url>             the event log: a SQLite file, :memory: for none, or postgres://...
                              (default $ENGRAM_DB_URL, else <home>/.engram/engram.db)

actor options (read, write, promote, explain):
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

doctor options:
  --db <path|url>             the event log to check (default as above); doctor never creates one
  --policy <preset|path>      the policy to load and validate
  --root <folder>             a store folder: readable, and its memories adopted through the plane
                              on an in-memory log (counts only)

output:
  --json                      machine-readable output
  -h, --help                  this text
`;

const COMMANDS: Record<string, (args: string[], io: Io) => Promise<number>> = {
  read: readCommand,
  write: writeCommand,
  explain: explainCommand,
  doctor: doctorCommand,
  promote: promoteCommand,
};

/** Commands in the architecture's CLI list whose cards have not landed, and the card for each. */
const NOT_YET: Record<string, string> = {
  lint: "L1",
  simulate: "E8.9",
  serve: "E8.1",
};

export async function run(argv: string[], io: Io): Promise<number> {
  const [command, ...args] = argv;
  if (command === undefined) {
    io.err(HELP);
    return 2;
  }
  if (command === "-h" || command === "--help" || command === "help") {
    io.out(HELP);
    return 0;
  }
  const card = NOT_YET[command];
  if (card !== undefined) {
    io.err(`engram ${command}: not implemented yet (card ${card})\n`);
    return 2;
  }
  const handler = COMMANDS[command];
  if (handler === undefined) {
    io.err(`engram: unknown command "${command}"; engram --help lists them\n`);
    return 2;
  }
  if (args.includes("-h") || args.includes("--help")) {
    io.out(HELP);
    return 0;
  }
  try {
    return await handler(args, io);
  } catch (e) {
    io.err(`engram ${command}: ${(e as Error).message}\n`);
    return e instanceof UsageError ? 2 : 1;
  }
}

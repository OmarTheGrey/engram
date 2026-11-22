// The command table. `run` takes the arguments and an Io (output, working
// directory, clock) and resolves to the exit code: 0 done, 1 a denied write,
// a denied or asked promotion, a refused sweep, a failed check or an error,
// 2 bad usage or a command whose card has not landed (the card named). Every
// command but doctor, serve, mcp, hook, key and log is one call of the generated client
// (card E8.2, ADR 0027): in process over the workspace its flags open, or to
// the server --server or ENGRAM_SERVER_URL names.
import {
  explainCommand,
  lintCommand,
  promoteCommand,
  readCommand,
  retainCommand,
  simulateCommand,
  writeCommand,
} from "./commands.ts";
import type { Fetch } from "./connect.ts";
import { doctorCommand } from "./doctor.ts";
import { hookCommand } from "./hook.ts";
import { keyCommand } from "./key.ts";
import { logCommand } from "./log.ts";
import { mcpCommand } from "./mcp.ts";
import { serveCommand } from "./serve.ts";
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
   * The environment: ENGRAM_DB_URL, ENGRAM_SERVER_URL, and the provider key
   * variables doctor checks by name only, never reading a value.
   */
  env: Readonly<Record<string, string | undefined>>;
  /** The running Node version, as in process.versions.node. */
  nodeVersion: string;
  /** The repository checkout the CLI runs from, for doctor's pin checks; undefined outside one. */
  repo: string | undefined;
  /** The fetch a call to a named server goes through; the global fetch when absent. */
  fetch?: Fetch;
  /** Wraps every client call's fetch, in process or not; tests count requests with it. */
  transport?: (fetch: Fetch) => Fetch;
  /** Aborted when a long-running command (serve, mcp) should stop. */
  stop?: AbortSignal;
  /** Standard input, for `engram hook` (the hook's JSON) and `engram mcp` over stdio. */
  stdin?: NodeJS.ReadableStream;
  /** Standard output as a stream, for `engram mcp` over stdio. */
  stdout?: NodeJS.WritableStream;
  /**
   * Doctor's store probes by check name, in place of the real ones; unset
   * outside tests (main.ts never sets it). A test about something else
   * (redaction, say) passes cheap probes so it does not open Mem0 and a
   * MemFS repository once per run (review finding R2-5).
   */
  doctorProbes?: Partial<Record<DoctorProbe, () => Promise<[Status, string]>>>;
}

/** The doctor checks that open a store and can be replaced through `Io.doctorProbes`. */
export type DoctorProbe = "adapter mem0" | "adapter letta";
type Status = "ok" | "fail" | "skip";

export const HELP = `engram: the Engram control plane from the command line

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
                              under any other key fails
  --checkpoint <file>         a checkpoint kept outside the log (log checkpoint --out);
                              repeatable; the log must extend it
  exit 0 OK, 1 FAILED (the first broken link is named), 3 UNSIGNED (every check holds, but
  the latest checkpoint carries no signature)

log checkpoint options:
  --db <path|url>             the event log (default as above); it must exist
  --key <private.pem>         the operator's Ed25519 private key; without it the checkpoint is unsigned
  --out <file>                also write the checkpoint there, to keep outside the log
  the key is the operator's to hold: a signature proves its holder saw that head

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

const COMMANDS: Record<string, (args: string[], io: Io) => Promise<number>> = {
  read: readCommand,
  write: writeCommand,
  explain: explainCommand,
  doctor: doctorCommand,
  promote: promoteCommand,
  retain: retainCommand,
  lint: lintCommand,
  simulate: simulateCommand,
  serve: serveCommand,
  mcp: mcpCommand,
  hook: hookCommand,
  log: logCommand,
  key: keyCommand,
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

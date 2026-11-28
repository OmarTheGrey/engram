// The command table. `run` takes the arguments and an Io (output, working
// directory, clock) and resolves to the exit code: 0 done, 1 a denied write,
// a denied or asked promotion, a refused sweep, a failed check or an error,
// 2 bad usage or a command whose card has not landed (the card named). Every
// command but doctor, serve, mcp, hook and key is one call of the generated
// client (card E8.2, ADR 0027): in process over the workspace its flags open,
// or to the server --server or ENGRAM_SERVER_URL names. The commands, their
// flags and HELP are the registry's (card E8.15a, ./registry.ts).
import { UnknownOptionError } from "./commands.ts";
import { drainExports, type Fetch } from "./connect.ts";
import { closest, commandWords, handlers, helpText, suggestionFlags } from "./registry.ts";
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
   * The TUI's plain and JSON views (card E8.15c): handed what a plane command
   * would print for the same answer in the other mode (--json when it prints
   * text, text when it prints --json), with no second call. Unset outside the TUI.
   */
  otherView?: (out: string) => void;
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
type Status = "ok" | "warn" | "fail" | "skip";

/** The help text, built from the command registry (card E8.15a, ./registry.ts). */
export const HELP = helpText();

/** The command table: one handler per command's first word, from the registry. */
const COMMANDS = handlers();

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
    // A second line when a command is close to the one typed (docs/design/tui.md 12.2).
    const near = closest(command, commandWords());
    if (near !== undefined) io.err(`engram: did you mean "${near}"?\n`);
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
    if (e instanceof UnknownOptionError) {
      const near = closest(e.option, suggestionFlags(command, args));
      if (near !== undefined) io.err(`engram ${command}: did you mean --${near}?\n`);
    }
    return e instanceof UsageError ? 2 : 1;
  } finally {
    // A decision export still sending (card E8.13) finishes before the command does.
    await drainExports();
  }
}

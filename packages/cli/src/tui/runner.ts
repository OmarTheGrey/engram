// Running an action (card E8.15b, docs/design/tui.md 6.2, ADR 0027): an
// action is its plain command's argument vector, run through the CLI's own
// `run` with the TUI's Io, so it is the same registry handler, the same
// parse, the same `connect` and the same client call, and prints the same
// bytes, which the TUI captures instead of writing to the terminal. The
// transport is teed so a screen can read the typed answer of the call (the
// read's id for the first loop's explain) without a second call. Standard
// input and output are never handed to a command: nothing the TUI runs can
// read the terminal or write to it.
import type { Fetch } from "../connect.ts";
import { type Io, run } from "../run.ts";

export interface Exchange {
  method: string;
  path: string;
  /** The request's JSON body; undefined when it had none (card E8.15c: the parity test reads it). */
  request?: unknown;
  status: number;
  /** The response's JSON body; undefined when it had none. */
  body: unknown;
}

export interface RunResult {
  argv: readonly string[];
  code: number;
  out: string;
  err: string;
  /**
   * What the same answer prints in the other mode (card E8.15c): the --json
   * output of a command run as text, for the JSON view; undefined when the
   * command has no --json or made no call.
   */
  other?: string;
  /** Every client call the command made, in order. */
  calls: Exchange[];
}

/** Runs `argv` as `engram <argv>` does, capturing its output, exit code and client calls. */
export async function runCommand(argv: readonly string[], io: Io): Promise<RunResult> {
  let out = "";
  let err = "";
  let other: string | undefined;
  const calls: Exchange[] = [];
  const tee =
    (fetch: Fetch): Fetch =>
    async (request) => {
      const method = request.method;
      const path = new URL(request.url).pathname;
      let sent: unknown;
      try {
        sent = JSON.parse(await request.clone().text());
      } catch {
        sent = undefined;
      }
      const response = await fetch(request);
      let body: unknown;
      try {
        body = await response.clone().json();
      } catch {
        body = undefined;
      }
      calls.push({ method, path, status: response.status, body, request: sent });
      return response;
    };
  const { stdin: _stdin, stdout: _stdout, ...rest } = io;
  const code = await run([...argv], {
    ...rest,
    out: (s) => {
      out += s;
    },
    err: (s) => {
      err += s;
    },
    transport: (fetch) => tee(io.transport ? io.transport(fetch) : fetch),
    otherView: (text) => {
      other = text;
    },
  });
  return { argv: [...argv], code, out, err, calls, ...(other === undefined ? {} : { other }) };
}

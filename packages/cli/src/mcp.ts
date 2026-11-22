// `engram mcp` (card E8.4, plan decision 6): the MCP server for Claude Code
// and Codex, over stdio (the default: the harness launches it) or streamable
// HTTP on a loopback port (--http). Its identity is fixed here, at launch:
// --as and --member name the one actor every tool call is made as, with
// source `model`; the model cannot choose another. Each tool call is one
// client call, in process over the workspace the flags open or to the server
// --server names. Nothing but the MCP protocol is written to stdout.
//
// Card E8.12 (ADR 0042): over --http the server needs credentials (--keys,
// or --issuer with --jwks and --subjects), and then each session is the
// actor its credential names, so --as, --member and --level are refused; or
// the waiver --insecure-loopback, under which the launch actor is used as
// before. stdio keeps --as and takes no credential flag.
import type { Actor } from "@engram/core";
import { createMcpServer, serveHttp, serveStdio } from "@engram/mcp";
import { parse } from "./commands.ts";
import { connect } from "./connect.ts";
import { AUTH_OPTIONS, OPTIONS } from "./registry.ts";
import type { Io } from "./run.ts";
import { serveAuth } from "./serve.ts";
import { buildActor, checkTime, UsageError } from "./setup.ts";

export async function mcpCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(args, OPTIONS.mcp, false);
  let port: number | undefined;
  if (values.http !== undefined) {
    port = Number(values.http);
    if (!/^\d+$/.test(values.http) || port > 65_535)
      throw new UsageError(`--http ${values.http} is not a port number`);
  }
  const authGiven = (Object.keys(AUTH_OPTIONS) as (keyof typeof AUTH_OPTIONS)[]).filter(
    (f) => values[f] !== undefined,
  );
  if (port === undefined && authGiven.length > 0)
    throw new UsageError(
      `${authGiven.map((f) => `--${f}`).join(", ")} apply to --http; over stdio the harness launches the server, and --as names its actor`,
    );
  const auth = port === undefined ? undefined : serveAuth(values, "127.0.0.1", io);
  const authenticated = auth !== undefined && auth.insecureLoopback !== true;
  if (
    authenticated &&
    (values.as !== undefined || values.member !== undefined || values.level !== undefined)
  )
    throw new UsageError(
      "--as, --member and --level name a self-asserted actor; with credentials each session is the actor its credential names (ADR 0042)",
    );
  const actor: Actor | undefined = authenticated
    ? undefined
    : buildActor(values, values.owner, "model");
  const conn = connect(
    io,
    values,
    () => ({
      store: values.store,
      root: values.root,
      owner: values.owner,
      importValidFrom: checkTime("--import-valid-from", values["import-valid-from"]),
      policy: values.policy,
      db: values.db,
      requireStore: false,
    }),
    (ws) => ws.open(),
  );
  try {
    const makeServer = (held?: Actor) => {
      const who = held ?? actor;
      if (who === undefined) throw new Error("an authenticated MCP session has no credential");
      return createMcpServer({
        client: conn.client,
        actor: who,
        now: io.now,
        newId: io.newId,
        // Card L6's tool, off unless asked for: the four tools are condition C7's.
        supersede: values.supersede === true,
      });
    };
    if (port === undefined || auth === undefined) {
      if (io.stdin === undefined || io.stdout === undefined)
        throw new UsageError("engram mcp over stdio needs standard input and output");
      await serveStdio(
        makeServer(),
        io.stdin as NodeJS.ReadableStream & import("node:stream").Readable,
        io.stdout as NodeJS.WritableStream & import("node:stream").Writable,
        io.stop,
      );
      return 0;
    }
    const server = await serveHttp(makeServer, {
      port,
      auth,
      ...(actor === undefined ? {} : { asserted: actor.id }),
    });
    io.err(
      actor === undefined
        ? `engram mcp: streamable HTTP on ${server.url}, authenticated, resource ${server.resource}; each session as its credential's actor\n`
        : `engram mcp: streamable HTTP on ${server.url} as ${actor.id} (insecure loopback: the actor is self-asserted)\n`,
    );
    await new Promise<void>((done) => {
      if (io.stop === undefined) return;
      if (io.stop.aborted) done();
      else io.stop.addEventListener("abort", () => done(), { once: true });
    });
    await server.close();
    return 0;
  } finally {
    conn.close();
  }
}

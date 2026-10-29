// `engram mcp` (card E8.4, plan decision 6): the MCP server for Claude Code
// and Codex, over stdio (the default: the harness launches it) or streamable
// HTTP on a loopback port (--http). Its identity is fixed here, at launch:
// --as and --member name the one actor every tool call is made as, with
// source `model`; the model cannot choose another. Each tool call is one
// client call, in process over the workspace the flags open or to the server
// --server names. Nothing but the MCP protocol is written to stdout.
import { createMcpServer, serveHttp, serveStdio } from "@engram/mcp";
import { ACTOR_OPTIONS, CLIENT_OPTIONS, parse, STORE_OPTIONS } from "./commands.ts";
import { connect } from "./connect.ts";
import type { Io } from "./run.ts";
import { buildActor, checkTime, UsageError } from "./setup.ts";

export async function mcpCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(
    args,
    {
      ...STORE_OPTIONS,
      as: ACTOR_OPTIONS.as,
      level: ACTOR_OPTIONS.level,
      member: ACTOR_OPTIONS.member,
      ...CLIENT_OPTIONS,
      http: { type: "string" },
    },
    false,
  );
  let port: number | undefined;
  if (values.http !== undefined) {
    port = Number(values.http);
    if (!/^\d+$/.test(values.http) || port > 65_535)
      throw new UsageError(`--http ${values.http} is not a port number`);
  }
  const actor = buildActor(values, values.owner, "model");
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
    const makeServer = () =>
      createMcpServer({ client: conn.client, actor, now: io.now, newId: io.newId });
    if (port === undefined) {
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
    const server = await serveHttp(makeServer, { port });
    io.err(`engram mcp: streamable HTTP on ${server.url} as ${actor.id}\n`);
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

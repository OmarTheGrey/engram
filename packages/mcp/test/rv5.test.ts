// Card RV5, findings RV-SRF-6 and RV-SRF-7 of the repository review of the
// surfaces. RV-SRF-6: over streamable HTTP each request got a new server, so
// memory_simulate replayed an empty workload. RV-SRF-7: stdio closed when its
// input ended and dropped the replies of calls still in flight.
import { PassThrough } from "node:stream";
import { createEngramClient } from "@engram/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, describe, expect, it } from "vitest";
import { createMcpServer } from "../src/server.ts";
import { type HttpListening, serveHttp, serveStdio } from "../src/transports.ts";
import { DANA, id, NOW, testWorkspace, textOf } from "./helpers.ts";

const WRITE = { name: "memory_write", arguments: { scope: "person:dana", content: "tea at four" } };

describe("RV-SRF-6: memory_simulate over streamable HTTP replays its session's calls", () => {
  let server: HttpListening | undefined;
  afterAll(async () => server?.close());

  it("keeps each session's steps, and only its own", async () => {
    const ws = await testWorkspace();
    server = await serveHttp(() => ws.makeServer(), { port: 0 });
    const url = new URL(server.url);
    const first = new Client({ name: "first", version: "0" });
    await first.connect(new StreamableHTTPClientTransport(url));
    await first.callTool(WRITE);
    await first.callTool({ name: "memory_read", arguments: { query: "tea" } });
    const report = JSON.parse(
      textOf(await first.callTool({ name: "memory_simulate", arguments: {} })),
    );
    expect(report.baseline.outcomes.map((o: { op: string }) => o.op)).toEqual(["write", "read"]);
    const second = new Client({ name: "second", version: "0" });
    await second.connect(new StreamableHTTPClientTransport(url));
    const theirs = JSON.parse(
      textOf(await second.callTool({ name: "memory_simulate", arguments: {} })),
    );
    expect(theirs.baseline.outcomes).toEqual([]);
    await first.close();
    await second.close();
  });

  it("answers 404 for a session it does not hold", async () => {
    if (server === undefined) throw new Error("the previous test starts the server");
    const answer = await fetch(server.url, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-session-id": "not-a-session",
      },
    });
    expect(answer.status).toBe(404);
  });
});

describe("RV-SRF-7: stdio answers the calls in flight before it closes", () => {
  it("replies to a write whose request arrived just before the input ended", async () => {
    const ws = await testWorkspace();
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    let written = "";
    stdout.on("data", (chunk: Buffer) => {
      written += chunk.toString();
    });
    // A plane that answers a little later than the input ends, as a real
    // write does: before RV5 the server closed, and the process exited,
    // with the reply still to come.
    const slow = createEngramClient({
      baseUrl: "http://127.0.0.1:7313",
      fetch: async (request) => {
        await new Promise((done) => setTimeout(done, 200));
        return ws.app.fetch(request);
      },
    });
    let n = 0;
    const server = createMcpServer({
      client: slow,
      actor: DANA,
      now: () => NOW,
      newId: () => id(900 + ++n),
    });
    const served = serveStdio(server, stdin, stdout);
    const line = (message: unknown) => stdin.write(`${JSON.stringify(message)}\n`);
    line({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "t", version: "0" },
      },
    });
    line({ jsonrpc: "2.0", method: "notifications/initialized" });
    line({ jsonrpc: "2.0", id: 2, method: "tools/call", params: WRITE });
    stdin.end();
    await served;
    const replies = written
      .split("\n")
      .filter((l) => l.trim() !== "")
      .map((l) => JSON.parse(l) as { id?: number; result?: { content: { text: string }[] } });
    const reply = replies.find((r) => r.id === 2);
    expect(reply?.result?.content[0]?.text).toContain("stored");
    expect(ws.workspace.plane.events().filter((e) => e.op === "write").length).toBeGreaterThan(3);
  });
});

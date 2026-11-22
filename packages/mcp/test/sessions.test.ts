// Review fix pass of PR #59 (RV5-5): the HTTP transport's session cap
// answered an evicted session's next request with a bare "Session not
// found", kept an idle session until 64 newer ones pushed it out, and let
// one session's memory_simulate workload grow without bound; stdio's drain
// timeout had no test. Here: the cap, the eviction and idle-expiry messages
// (the idle clock injected), the bound on a session's steps, and the 30 s
// drain (the timer injected).
import { PassThrough } from "node:stream";
import { createEngramClient } from "@engram/sdk";
import { afterEach, describe, expect, it } from "vitest";
import { createMcpServer } from "../src/server.ts";
import {
  type HttpListening,
  MAX_HTTP_SESSIONS,
  MCP_IDLE_MS,
  STDIO_DRAIN_MS,
  serveHttp,
  serveStdio,
} from "../src/transports.ts";
import { DANA, id, NOW, testWorkspace, textOf } from "./helpers.ts";

const WRITE = { name: "memory_write", arguments: { scope: "person:dana", content: "tea at four" } };

const listening: HttpListening[] = [];
afterEach(async () => {
  for (const s of listening.splice(0)) await s.close();
});

/** A raw tools/list under a session id, as a client whose session ended would send it. */
async function listUnder(url: string, sessionId: string) {
  const answer = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/list" }),
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-session-id": sessionId,
      "mcp-protocol-version": "2025-06-18",
    },
  });
  return { status: answer.status, body: (await answer.json()) as { error?: { message: string } } };
}

/**
 * A session started with a raw initialize, so no client sends requests of
 * its own (the SDK client's background stream would refresh the idle clock).
 */
async function connect(url: string) {
  const answer = await fetch(url, {
    method: "POST",
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "t", version: "0" },
      },
    }),
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
  });
  expect(answer.status).toBe(200);
  await answer.text();
  const sessionId = answer.headers.get("mcp-session-id") ?? "";
  expect(sessionId).not.toBe("");
  return { sessionId };
}

describe("RV5-5: the HTTP transport's sessions", () => {
  it("keeps 64 sessions by default and idles one out after 30 minutes", () => {
    expect(MAX_HTTP_SESSIONS).toBe(64);
    expect(MCP_IDLE_MS).toBe(30 * 60_000);
  });

  it("past the cap, the least recently used session is evicted, and its next request is told so", async () => {
    const ws = await testWorkspace();
    const server = await serveHttp(() => ws.makeServer(), {
      port: 0,
      maxSessions: 2,
      auth: { insecureLoopback: true },
    });
    listening.push(server);
    const a = await connect(server.url);
    const b = await connect(server.url);
    expect((await listUnder(server.url, a.sessionId)).status).toBe(200);
    // a was just used, so b is the least recently used when c starts.
    const c = await connect(server.url);
    const evicted = await listUnder(server.url, b.sessionId);
    expect(evicted.status).toBe(404);
    expect(evicted.body.error?.message).toContain("evicted");
    expect(evicted.body.error?.message).toContain("2");
    expect((await listUnder(server.url, a.sessionId)).status).toBe(200);
    expect((await listUnder(server.url, c.sessionId)).status).toBe(200);
    // A session the server never held is still plain "not found".
    const unknown = await listUnder(server.url, "never-a-session");
    expect(unknown.status).toBe(404);
    expect(unknown.body.error?.message).toBe("Session not found");
  });

  it("a session idle longer than idleMs is closed, and its next request is told it expired", async () => {
    const ws = await testWorkspace();
    let clock = 1_000_000;
    const server = await serveHttp(() => ws.makeServer(), {
      port: 0,
      idleMs: 60_000,
      now: () => clock,
      auth: { insecureLoopback: true },
    });
    listening.push(server);
    const a = await connect(server.url);
    const b = await connect(server.url);
    clock += 59_000;
    expect((await listUnder(server.url, a.sessionId)).status).toBe(200);
    clock += 59_000;
    // a was seen 59 s ago, b 118 s ago: b has expired, a has not.
    expect((await listUnder(server.url, a.sessionId)).status).toBe(200);
    const expired = await listUnder(server.url, b.sessionId);
    expect(expired.status).toBe(404);
    expect(expired.body.error?.message).toContain("idle");
  });
});

describe("RV5-5: a session's memory_simulate workload is bounded", () => {
  it("past maxSteps, memory_simulate refuses rather than replay a cut workload", async () => {
    const ws = await testWorkspace();
    let n = 0;
    const server = createMcpServer({
      client: ws.client,
      actor: DANA,
      now: () => NOW,
      newId: () => id(950 + ++n),
      maxSteps: 2,
    });
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const served = serveStdio(server, stdin, stdout);
    const replies: { id?: number; result?: { content: { text: string }[]; isError?: boolean } }[] =
      [];
    let buffer = "";
    stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const l of lines) if (l.trim() !== "") replies.push(JSON.parse(l));
    });
    const send = (message: unknown) => stdin.write(`${JSON.stringify(message)}\n`);
    const reply = async (rid: number) => {
      for (let i = 0; i < 400 && !replies.some((r) => r.id === rid); i++)
        await new Promise((done) => setImmediate(done));
      return replies.find((r) => r.id === rid);
    };
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "t", version: "0" },
      },
    });
    await reply(1);
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: WRITE });
    await reply(2);
    send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: WRITE });
    await reply(3);
    send({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "memory_simulate", arguments: {} },
    });
    const within = await reply(4);
    expect(within?.result?.isError).toBeUndefined();
    send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: WRITE });
    await reply(5);
    send({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "memory_simulate", arguments: {} },
    });
    const past = await reply(6);
    expect(past?.result?.isError).toBe(true);
    expect(textOf(past?.result)).toContain("more than 2 calls");
    stdin.end();
    await served;
  });
});

describe("RV5-5: stdio's drain after its input ends", () => {
  it("waits STDIO_DRAIN_MS for a call in flight, then closes (timer injected)", async () => {
    // A plane that never answers: only the drain timer can end the wait.
    const stuck = createEngramClient({
      baseUrl: "http://127.0.0.1:7313",
      fetch: () => new Promise<Response>(() => {}),
    });
    const server = createMcpServer({
      client: stuck,
      actor: DANA,
      now: () => NOW,
      newId: () => id(990),
    });
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const timers: { ms: number; fire: () => void }[] = [];
    let armed: () => void = () => {};
    const timerArmed = new Promise<void>((done) => {
      armed = done;
    });
    const served = serveStdio(server, stdin, stdout, undefined, {
      setTimeout: (fire, ms) => {
        timers.push({ ms, fire });
        armed();
        return timers.length;
      },
      clearTimeout: () => {},
    });
    let closed = false;
    void served.then(() => {
      closed = true;
    });
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
    await timerArmed;
    expect(timers.map((t) => t.ms)).toEqual([STDIO_DRAIN_MS]);
    await new Promise((done) => setTimeout(done, 20));
    expect(closed).toBe(false);
    timers[0]?.fire();
    await served;
    expect(closed).toBe(true);
  });
});

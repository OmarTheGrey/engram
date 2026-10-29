// Card E8.4's acceptance: an MCP client runs memory_explain on a fixture read,
// over the in-memory, stdio and streamable HTTP transports. Also: the tools
// are the pi extension's (names, descriptions, wording), no parameter names an
// actor or a source, a write that claims `user` lands as `model` (decision
// D4), simulate is a tool error naming card E8.9, the HTTP transport refuses a
// foreign Origin, and loading the server loads no pi package.
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  MEMORY_EXPLAIN,
  MEMORY_READ,
  MEMORY_SIMULATE,
  MEMORY_WRITE,
} from "@engram/pi-extension/tools";
import { MAX_BODY_BYTES } from "@engram/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, describe, expect, it } from "vitest";
import { type HttpListening, MCP_PATH, serveHttp } from "../src/transports.ts";
import { DANA, FIXTURE, readIdOf, testWorkspace, textOf } from "./helpers.ts";

const REPO = resolve(fileURLToPath(import.meta.url), "../../../..");
const MAIN = join(REPO, "packages/cli/src/main.ts");
const dirs: string[] = [];
afterAll(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

async function inMemory(ws: Awaited<ReturnType<typeof testWorkspace>>, actor = DANA) {
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  await ws.makeServer(actor).connect(serverSide);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientSide);
  return client;
}

/** memory_read, then memory_explain on that read; returns both texts. */
async function readThenExplain(client: Client, query: string) {
  const read = textOf(await client.callTool({ name: "memory_read", arguments: { query } }));
  const readId = readIdOf(read);
  const explained = await client.callTool({
    name: "memory_explain",
    arguments: { read_id: readId },
  });
  return { read, readId, explained, explanations: JSON.parse(textOf(explained)) };
}

describe("over the in-memory transport", () => {
  it("lists the pi extension's four tools, with its names and descriptions", async () => {
    const client = await inMemory(await testWorkspace());
    const { tools } = await client.listTools();
    expect(tools.map((t) => [t.name, t.description])).toEqual(
      [MEMORY_WRITE, MEMORY_READ, MEMORY_EXPLAIN, MEMORY_SIMULATE].map((t) => [
        t.name,
        t.description,
      ]),
    );
  });

  it("names no actor, source or provenance in any tool's parameters", async () => {
    const client = await inMemory(await testWorkspace());
    const { tools } = await client.listTools();
    const names = tools.flatMap((t) => Object.keys(t.inputSchema.properties ?? {}));
    for (const forbidden of ["actor", "source", "provenance", "kind", "owner", "as"])
      expect(names).not.toContain(forbidden);
  });

  it("explains a fixture read: the read's tag and its explanations", async () => {
    const ws = await testWorkspace();
    const client = await inMemory(ws);
    const { read, readId, explanations } = await readThenExplain(client, "release freeze");
    expect(read).toMatch(
      /^<engram:memory read_id="[^"]+" policy_id="preset\.medium\/read\/person" filtered="0">/,
    );
    expect(read).toContain(FIXTURE[1]);
    expect(explanations[0]).toMatchObject({ rank: 1, policy_id: "preset.medium/read/person" });
    const event = ws.workspace.plane.events().find((e) => e.id === readId);
    expect(event).toMatchObject({ op: "read", actor: "person:dana" });
  });

  it("lands a write that claims user, an actor and a provenance as model by the launch actor", async () => {
    const ws = await testWorkspace();
    const client = await inMemory(ws);
    const result = await client.callTool({
      name: "memory_write",
      arguments: {
        scope: "person:dana",
        content: "Dana prefers short reviews.",
        source: "user",
        actor: "person:boss",
        provenance: { kind: "user", actor: "person:boss" },
      },
    });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toMatch(/^stored \S+ in person:dana as active$/);
    const written = ws.workspace.plane.events().at(-1);
    expect(written).toMatchObject({ op: "write", decision: "allow", actor: "person:dana" });
    expect(written?.item?.provenance).toMatchObject({ kind: "model", actor: "person:dana" });
  });

  it("labels a write model even when the launch actor carries source user (R3-5)", async () => {
    const ws = await testWorkspace();
    const client = await inMemory(ws, { ...DANA, source: "user" });
    const result = await client.callTool({
      name: "memory_write",
      arguments: { scope: "person:dana", content: "Launched as a user." },
    });
    expect(result.isError).toBeFalsy();
    const written = ws.workspace.plane.events().at(-1);
    expect(written?.item?.provenance).toMatchObject({ kind: "model", actor: "person:dana" });
  });

  it("returns a denied write as a tool error with the plane's reason", async () => {
    const client = await inMemory(await testWorkspace());
    const result = await client.callTool({
      name: "memory_write",
      arguments: { scope: "person:bob", content: "x" },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/^engram: .* \(engram\/write\/membership\)$/);
  });

  it("refuses another actor's read id in explain", async () => {
    const ws = await testWorkspace();
    const { readId } = await readThenExplain(await inMemory(ws), "freeze");
    const eve = await inMemory(ws, { id: "person:eve", level: "person", memberships: [] });
    const result = await eve.callTool({ name: "memory_explain", arguments: { read_id: readId } });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("only its reader may explain it");
  });

  it("answers memory_simulate with a tool error naming card E8.9", async () => {
    const client = await inMemory(await testWorkspace());
    const result = await client.callTool({ name: "memory_simulate", arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("memory_simulate: not implemented yet (card E8.9)");
  });

  it("refuses arguments that fail the tool's schema", async () => {
    const client = await inMemory(await testWorkspace());
    const result = await client.callTool({ name: "memory_read", arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("memory_read: invalid arguments");
  });
});

describe("over streamable HTTP", () => {
  let server: HttpListening | undefined;
  afterAll(async () => server?.close());

  it("explains a fixture read", async () => {
    const ws = await testWorkspace();
    server = await serveHttp(() => ws.makeServer(), { port: 0 });
    expect(server.url).toBe(`http://127.0.0.1:${server.port}${MCP_PATH}`);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(server.url)));
    const { read, explanations } = await readThenExplain(client, "runbook");
    expect(read).toContain(FIXTURE[2]);
    expect(explanations.length).toBeGreaterThan(0);
    await client.close();
  });

  it("refuses a foreign Origin and a rebound Host", async () => {
    if (server === undefined) throw new Error("the previous test starts the server");
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    };
    const foreign = await fetch(server.url, {
      method: "POST",
      body,
      headers: { ...headers, origin: "http://evil.example" },
    });
    expect(foreign.status).toBe(403);
    const own = await fetch(server.url, {
      method: "POST",
      body,
      headers: { ...headers, origin: `http://127.0.0.1:${server.port}` },
    });
    expect(own.status).toBe(200);
  });

  it("refuses a body over the API's 1 MiB cap (R3-12)", async () => {
    if (server === undefined) throw new Error("the first test starts the server");
    const big = await fetch(server.url, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "x".repeat(MAX_BODY_BYTES) }),
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
    });
    expect(big.status).toBe(413);
  });

  it("refuses to listen on a host that is not loopback", async () => {
    const ws = await testWorkspace();
    expect(() => serveHttp(() => ws.makeServer(), { host: "0.0.0.0", port: 0 })).toThrow(
      /not a loopback address/,
    );
  });
});

describe("over stdio, launched as engram mcp", () => {
  it("explains a read of the Claude Code memory fixture adopted by the server", async () => {
    const root = await mkdtemp(join(tmpdir(), "engram-mcp-"));
    dirs.push(root);
    await cp(join(REPO, "fixtures/stores/claude-code-memory"), root, { recursive: true });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        MAIN,
        ...["mcp", "--as", "person:dana", "--root", root, "--owner", "dana"],
        ...["--db", ":memory:", "--import-valid-from", "2026-10-01T00:00:00.000Z"],
      ],
      cwd: root,
      env: { ...(process.env as Record<string, string>), HOME: root, USERPROFILE: root },
      stderr: "pipe",
    });
    const client = new Client({ name: "test", version: "0" });
    await client.connect(transport);
    const { read, readId, explanations } = await readThenExplain(client, "");
    expect(readId).not.toBe("");
    expect(read.match(/<engram:item /g)).toHaveLength(4);
    expect(explanations).toHaveLength(4);
    await client.close();
  });
});

describe("loading the MCP server", () => {
  it("loads no pi package at run time", () => {
    const entry = pathToFileURL(join(REPO, "packages/mcp/src/index.ts")).href;
    const script = [
      'import { registerHooks } from "node:module";',
      "const seen = [];",
      "registerHooks({ resolve(s, c, next) { const r = next(s, c); seen.push(r.url); return r; } });",
      `await import(${JSON.stringify(entry)});`,
      'process.stdout.write(JSON.stringify({ total: seen.length, pi: seen.filter((u) => u.includes("@earendil-works")) }));',
    ].join("\n");
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: REPO,
      encoding: "utf8",
      timeout: 60_000,
    });
    const out = JSON.parse(r.stdout);
    expect(out.total).toBeGreaterThan(10);
    expect(out.pi).toEqual([]);
  });
});

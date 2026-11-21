// The MCP server's streamable HTTP transport as an OAuth 2.1 resource server
// (card E8.12, ADR 0042): no credential, no session; a session is the actor
// its API key names, every call labelled source model; another credential
// may not use the session; every event its calls append is attested
// `mcp_http`. Keys only here: the token path is the HTTP API's own
// (packages/server/test/auth.test.ts), behind the same credentialGuard.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeAdapter } from "@engram/adapters";
import { type Actor, allEvents, loadPreset, migrate, openSqlite } from "@engram/core";
import { createEngramClient } from "@engram/sdk";
import {
  attestations,
  attestingDb,
  createApp,
  createKey,
  openCredentials,
  workspaceOf,
} from "@engram/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, describe, expect, it } from "vitest";
import { createMcpServer } from "../src/server.ts";
import { type HttpListening, serveHttp } from "../src/transports.ts";
import { id, NOW, textOf } from "./helpers.ts";

const dirs: string[] = [];
const servers: HttpListening[] = [];
afterAll(async () => {
  for (const s of servers) await s.close();
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

const DANA = {
  id: "person:dana",
  level: "person" as const,
  memberships: ["person:dana"],
  source: "user" as const,
};
const EVE = { ...DANA, id: "person:eve", memberships: ["person:eve"] };

async function served() {
  const dir = await mkdtemp(join(tmpdir(), "engram-mcp-auth-"));
  dirs.push(dir);
  const keys = join(dir, "keys.json");
  const expires = "2026-12-29T12:00:00.000Z";
  const dana = createKey(keys, { actor: DANA, expires, now: NOW }).key;
  const eve = createKey(keys, { actor: EVE, expires, now: NOW }).key;
  const raw = openSqlite(":memory:");
  migrate(raw);
  const db = attestingDb(raw);
  let n = 0;
  const newId = () => id(++n);
  const workspace = workspaceOf({
    db,
    adapter: createFakeAdapter(),
    policy: loadPreset("medium"),
    newId,
  });
  const app = createApp(workspace, { port: 7313, now: () => NOW });
  const client = createEngramClient({
    baseUrl: "http://127.0.0.1:7313",
    fetch: async (request) => app.fetch(request),
  });
  const credentials = openCredentials({ keys }, (p) => p);
  if (credentials === undefined) throw new Error("no credentials");
  const server = await serveHttp(
    (actor?: Actor) => {
      if (actor === undefined) throw new Error("no credential's actor");
      return createMcpServer({ client, actor, now: () => NOW, newId });
    },
    { port: 0, auth: { credentials }, clock: () => NOW },
  );
  servers.push(server);
  return { server, db, dana, eve };
}

const connect = async (url: string, key: string) => {
  const client = new Client({ name: "test", version: "0" });
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { authorization: `Bearer ${key}` } },
  });
  await client.connect(transport);
  return { client, transport };
};

const initialize = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "t", version: "0" },
  },
});
const headers = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};

describe("engram mcp --http with credentials", () => {
  it("refuses a request with no credential, naming the path-suffixed metadata (RFC 9728)", async () => {
    const { server } = await served();
    const r = await fetch(server.url, { method: "POST", body: initialize, headers });
    expect(r.status).toBe(401);
    const origin = new URL(server.url).origin;
    expect(r.headers.get("www-authenticate")).toBe(
      `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`,
    );
    const meta = await fetch(`${origin}/.well-known/oauth-protected-resource/mcp`);
    expect(await meta.json()).toEqual({
      resource: server.url,
      bearer_methods_supported: ["header"],
      resource_name: "Engram",
    });
  });

  it("a session is its key's actor, writes as source model, and its events are attested", async () => {
    const { server, db, dana } = await served();
    const { client } = await connect(server.url, dana);
    const result = await client.callTool({
      name: "memory_write",
      arguments: { scope: "person:dana", content: "Dana prefers short reviews." },
    });
    expect(result.isError).toBeUndefined();
    const [event] = allEvents(db);
    expect(event?.actor).toBe("person:dana");
    expect(event?.item?.provenance.kind).toBe("model");
    expect(attestations(db)).toEqual([
      expect.objectContaining({
        seq: event?.seq,
        surface: "mcp_http",
        method: "api_key",
        actor: "person:dana",
        issuer: null,
      }),
    ]);
    textOf(await client.callTool({ name: "memory_read", arguments: { query: "reviews" } }));
    expect(attestations(db)).toHaveLength(allEvents(db).length);
    await client.close();
  });

  it("refuses another credential on a session it did not start (403)", async () => {
    const { server, dana, eve } = await served();
    const started = await fetch(server.url, {
      method: "POST",
      body: initialize,
      headers: { ...headers, authorization: `Bearer ${dana}` },
    });
    expect(started.status).toBe(200);
    const sid = started.headers.get("mcp-session-id") ?? "";
    expect(sid).not.toBe("");
    const list = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const hijack = await fetch(server.url, {
      method: "POST",
      body: list,
      headers: {
        ...headers,
        authorization: `Bearer ${eve}`,
        "mcp-session-id": sid,
        "mcp-protocol-version": "2025-06-18",
      },
    });
    expect(hijack.status).toBe(403);
  });
});

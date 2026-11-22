// The attestation invariant of card E8.12 (ADR 0042 decision 8) on the MCP
// server's streamable HTTP transport, with credentials (review finding
// E8.12-2): after a seeded run of tool calls from one session per API key,
// interleaved four at a time with refusals (no credential, the encoded path
// `/%6Dcp` with a live session's id, a revoked key, another credential on a
// session), every event in the log has exactly one row in
// event_attestations, on surface `mcp_http`, with method `jwt` or `api_key`
// (never the waiver), naming the event's own actor; and no refused call left
// an event. Keys only: the token path is the API's (packages/server).
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { request as httpRequest } from "node:http";
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
  revokeKey,
  workspaceOf,
} from "@engram/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, expect, it } from "vitest";
import { createMcpServer } from "../src/server.ts";
import { type HttpListening, serveHttp } from "../src/transports.ts";
import { id, NOW } from "./helpers.ts";

const dirs: string[] = [];
const servers: HttpListening[] = [];
const clients: Client[] = [];
const logs: { close(): void }[] = [];
afterAll(async () => {
  for (const c of clients) await c.close();
  for (const s of servers) await s.close();
  for (const l of logs) l.close();
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

const held = (who: string, scope: string, level: "person" | "team" = "person") => ({
  id: who,
  level,
  memberships: [scope],
  source: "user" as const,
});
const ACTORS = {
  dana: { actor: held("person:dana", "person:dana"), scope: "person:dana" },
  eve: { actor: held("person:eve", "person:eve"), scope: "person:eve" },
  ci: { actor: held("agent:ci", "team:platform", "team"), scope: "team:platform" },
} as const;

/** A seeded generator (mulberry32) from the test's name. */
function rng(name: string) {
  let a = createHash("sha256").update(name).digest().readUInt32LE(0);
  const seed = a;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return { seed, pick: <T>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)] as T };
}

const headers = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};

const rawPost = (port: number, path: string, body: string, extra: Record<string, string>) =>
  new Promise<number>((done, fail) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: { ...headers, host: `127.0.0.1:${port}`, ...extra },
      },
      (res) => {
        res.resume();
        res.on("end", () => done(res.statusCode ?? 0));
      },
    );
    req.on("error", fail);
    req.end(body);
  });

const refusedWrite = (n: number) =>
  JSON.stringify({
    jsonrpc: "2.0",
    id: 1000 + n,
    method: "tools/call",
    params: { name: "memory_write", arguments: { scope: "person:dana", content: `REFUSED ${n}` } },
  });

it("every event the MCP HTTP surface writes names its session's authenticated actor", async () => {
  const { seed, pick } = rng("every event the MCP HTTP surface writes names its session's actor");
  const dir = await mkdtemp(join(tmpdir(), "engram-mcp-attest-"));
  dirs.push(dir);
  const keys = join(dir, "keys.json");
  const expires = "2026-12-29T12:00:00.000Z";
  const keyOf = Object.fromEntries(
    Object.entries(ACTORS).map(([name, a]) => [
      name,
      createKey(keys, { actor: a.actor, expires, now: NOW }).key,
    ]),
  ) as Record<keyof typeof ACTORS, string>;
  const revoked = createKey(keys, {
    actor: held("person:mallory", "person:mallory"),
    expires,
    now: NOW,
  });

  const raw = openSqlite(join(dir, "engram.db"));
  logs.push(raw);
  migrate(raw);
  const db = attestingDb(raw);
  let n = 0;
  const newId = () => id(600_000 + ++n);
  const workspace = workspaceOf({
    db,
    adapter: createFakeAdapter(),
    policy: loadPreset("medium"),
    newId,
  });
  const app = createApp(workspace, { port: 7313, now: () => NOW });
  const client = createEngramClient({
    baseUrl: "http://127.0.0.1:7313",
    fetch: async (r) => app.fetch(r),
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

  // One session per key, and mallory's, revoked once it is open.
  const sessions: Record<string, { client: Client; sid: string }> = {};
  for (const [name, key] of [...Object.entries(keyOf), ["mallory", revoked.key] as const]) {
    const c = new Client({ name, version: "0" });
    const transport = new StreamableHTTPClientTransport(new URL(server.url), {
      requestInit: { headers: { authorization: `Bearer ${key}` } },
    });
    await c.connect(transport);
    clients.push(c);
    sessions[name] = { client: c, sid: transport.sessionId ?? "" };
  }
  revokeKey(keys, revoked.record.id, NOW);
  const session = (name: string) => ({
    "mcp-session-id": sessions[name]?.sid ?? "",
    "mcp-protocol-version": "2025-06-18",
  });

  const names = Object.keys(ACTORS) as (keyof typeof ACTORS)[];
  const refusals: Promise<number>[] = [];
  let calls = 0;
  const step = () => {
    calls++;
    const name = pick(names);
    const kind = pick(["write", "write", "read", "refused"] as const);
    const c = sessions[name]?.client;
    if (c === undefined) throw new Error("no session");
    if (kind === "write")
      return c.callTool({
        name: "memory_write",
        arguments: { scope: ACTORS[name].scope, content: `fact ${calls} of ${name}` },
      });
    if (kind === "read") return c.callTool({ name: "memory_read", arguments: { query: "fact" } });
    const which = pick(["none", "encoded", "revoked", "other"] as const);
    const other = names.find((x) => x !== name) ?? "dana";
    const r =
      which === "none"
        ? rawPost(server.port, "/mcp", refusedWrite(calls), session(name))
        : which === "encoded"
          ? rawPost(server.port, "/%6Dcp", refusedWrite(calls), session(name))
          : which === "revoked"
            ? rawPost(server.port, "/mcp", refusedWrite(calls), {
                ...session("mallory"),
                authorization: `Bearer ${revoked.key}`,
              })
            : rawPost(server.port, "/mcp", refusedWrite(calls), {
                ...session(name),
                authorization: `Bearer ${keyOf[other]}`,
              });
    refusals.push(r);
    return r;
  };
  for (let batch = 0; batch < 10; batch++) await Promise.all(Array.from({ length: 4 }, step));

  for (const status of await Promise.all(refusals))
    expect([401, 403, 404], `seed ${seed}`).toContain(status);
  const events = allEvents(raw);
  const rows = new Map(attestations(raw).map((r) => [r.seq, r]));
  expect(events.length, `seed ${seed}`).toBeGreaterThan(10);
  expect(rows.size, `seed ${seed}`).toBe(events.length);
  for (const e of events) {
    const row = rows.get(e.seq);
    expect(row, `seed ${seed}: event ${e.seq} has no attestation`).toBeDefined();
    expect(row?.event_id).toBe(e.id);
    expect(row?.surface).toBe("mcp_http");
    expect(["jwt", "api_key"]).toContain(row?.method);
    expect(row?.actor, `seed ${seed}: event ${e.seq}`).toBe(e.actor);
    expect(e.actor).not.toBe("person:mallory");
    expect(String(e.item?.content ?? "")).not.toMatch(/^REFUSED/);
  }
});

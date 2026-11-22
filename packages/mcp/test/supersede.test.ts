// memory_supersede (card L6): the supersession plan over MCP, and each
// accepted close one ordinary write through the gate as the launch actor
// with source model. Off by default: a server launched without `supersede`
// lists the four tools it always has (condition C7's tool set is unchanged)
// and refuses the name; with it, the plan is the supersede route's, an
// accepted close is a governed write, and memory_simulate replays it.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createFakeAdapter } from "@engram/adapters";
import {
  type Actor,
  itemById,
  loadPreset,
  type MemoryItem,
  migrate,
  openSqlite,
} from "@engram/core";
import { createEngramClient } from "@engram/sdk";
import { createApp, workspaceOf } from "@engram/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, describe, expect, it } from "vitest";
import { createMcpServer } from "../src/server.ts";
import { DANA, id, NOW, testWorkspace, textOf } from "./helpers.ts";

const OLD = id(100);
const NEW = id(200);
const LATER = "2026-10-15T00:00:00.000Z";

/** The workspace with a replacement of fixture item 100 from a later date, written by dana. */
async function replaced() {
  const ws = await testWorkspace();
  const old = ws.workspace.plane.events().find((e) => e.item_id === OLD)?.item;
  if (!old) throw new Error("the fixture item is missing");
  const { event } = await ws.workspace.plane.write(
    { ...DANA, source: "user" },
    {
      ...old,
      id: NEW,
      content: "Dana reviews pull requests after lunch.",
      valid_from: LATER,
      lineage: [OLD],
      store_ref: null,
    } as MemoryItem,
    NOW,
  );
  expect(event.decision).toBe("allow");
  return ws;
}

async function connect(
  ws: Awaited<ReturnType<typeof testWorkspace>>,
  supersede: boolean,
  actor: Actor = DANA,
) {
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  let n = 0;
  await createMcpServer({
    client: ws.client,
    actor,
    now: () => NOW,
    newId: () => id(900 + ++n),
    ...(supersede ? { supersede: true } : {}),
  }).connect(serverSide);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientSide);
  return client;
}

describe("memory_supersede", () => {
  it("is off by default: the four tools only, and the name is refused", async () => {
    const client = await connect(await replaced(), false);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual([
      "memory_write",
      "memory_read",
      "memory_explain",
      "memory_simulate",
    ]);
    const result = await client.callTool({ name: "memory_supersede", arguments: { item_id: NEW } });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("engram: no tool named memory_supersede");
  });

  it("with supersede on, is listed fifth and names no actor, source or provenance", async () => {
    const client = await connect(await replaced(), true);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).at(-1)).toBe("memory_supersede");
    const names = tools.flatMap((t) => Object.keys(t.inputSchema.properties ?? {}));
    for (const forbidden of ["actor", "source", "provenance", "kind", "owner", "as"])
      expect(names).not.toContain(forbidden);
  });

  it("without accept, returns the plan and writes nothing", async () => {
    const ws = await replaced();
    const client = await connect(ws, true);
    const before = ws.workspace.plane.events().length;
    const result = await client.callTool({ name: "memory_supersede", arguments: { item_id: NEW } });
    expect(result.isError).toBeFalsy();
    const plan = JSON.parse(textOf(result));
    expect(plan.head).toEqual({ ok: true, head_id: NEW, chain: [NEW] });
    expect(plan.proposals).toEqual([
      expect.objectContaining({ item_id: OLD, action: "close", valid_to: LATER }),
    ]);
    expect(plan.applied).toEqual([]);
    expect(ws.workspace.plane.events()).toHaveLength(before);
  });

  it("an accepted close is a governed write as the launch actor with source model", async () => {
    const ws = await replaced();
    const client = await connect(ws, true);
    const result = await client.callTool({
      name: "memory_supersede",
      arguments: { item_id: NEW, accept: [OLD], actor: "person:boss", source: "user" },
    });
    const plan = JSON.parse(textOf(result));
    expect(plan.applied).toHaveLength(1);
    const written = ws.workspace.plane.events().at(-1);
    expect(written).toMatchObject({ op: "write", item_id: OLD, actor: "person:dana" });
    // Medium lets a model-sourced write into the actor's own person scope;
    // the item's provenance is the writer's, as for any rewrite (decision D4).
    expect(written?.decision).toBe("allow");
    expect(plan.applied[0].event.id).toBe(written?.id);
    expect(result.isError).toBeFalsy();
    expect(written?.item).toMatchObject({ valid_to: LATER, version: 2, status: "active" });
    expect(written?.item?.provenance).toMatchObject({ kind: "model", actor: "person:dana" });
  });

  it("an item the launch actor cannot read is unknown_id, a tool error", async () => {
    const ws = await replaced();
    const sam: Actor = { id: "person:sam", level: "person", memberships: ["person:sam"] };
    const client = await connect(ws, true, sam);
    const result = await client.callTool({
      name: "memory_supersede",
      arguments: { item_id: NEW },
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(textOf(result)).head).toEqual({ ok: false, error: "unknown_id", chain: [] });
  });

  it("an id with no proposed close is a tool error, and nothing is written", async () => {
    const ws = await replaced();
    const client = await connect(ws, true);
    const before = ws.workspace.plane.events().length;
    const result = await client.callTool({
      name: "memory_supersede",
      arguments: { item_id: NEW, accept: [NEW] },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("no close is proposed");
    expect(ws.workspace.plane.events()).toHaveLength(before);
  });

  it("memory_simulate replays an accepted close as the write it was", async () => {
    const ws = await replaced();
    const client = await connect(ws, true);
    await client.callTool({ name: "memory_supersede", arguments: { item_id: NEW, accept: [OLD] } });
    const report = JSON.parse(
      textOf(await client.callTool({ name: "memory_simulate", arguments: {} })),
    );
    // The plan alone is no Plane call; the close is one write step, of item 100.
    expect(
      report.baseline.outcomes.map((o: { op: string; item_id: string }) => [o.op, o.item_id]),
    ).toEqual([["write", OLD]]);
  });
});

describe("engram mcp --supersede", () => {
  const MAIN = join(
    resolve(fileURLToPath(import.meta.url), "../../../.."),
    "packages/cli/src/main.ts",
  );
  const dirs: string[] = [];
  afterAll(async () => {
    for (const dir of dirs) await rm(dir, { recursive: true, force: true });
  });

  /** The tool names `engram mcp` lists over stdio, launched with `more`. */
  async function listed(...more: string[]) {
    const root = await mkdtemp(join(tmpdir(), "engram-mcp-"));
    dirs.push(root);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [MAIN, "mcp", "--as", "person:dana", "--db", ":memory:", ...more],
      cwd: root,
      env: { ...(process.env as Record<string, string>), HOME: root, USERPROFILE: root },
      stderr: "pipe",
    });
    const client = new Client({ name: "test", version: "0" });
    await client.connect(transport);
    const { tools } = await client.listTools();
    await client.close();
    return tools.map((t) => t.name);
  }

  it("lists memory_supersede only when launched with the flag", async () => {
    expect(await listed()).not.toContain("memory_supersede");
    expect((await listed("--supersede")).at(-1)).toBe("memory_supersede");
  });
});

describe("memory_supersede under the trust floors (L6-4)", () => {
  /** A workspace on `preset`: dana's user-written fact and her replacement naming it. */
  async function on(preset: "medium" | "medium-trust") {
    const db = openSqlite(":memory:");
    migrate(db);
    let n = 0;
    const newId = () => id(700 + ++n);
    const workspace = workspaceOf({
      db,
      adapter: createFakeAdapter(),
      policy: loadPreset(preset),
      newId,
    });
    const app = createApp(workspace, { port: 7313, now: () => NOW });
    const client = createEngramClient({
      baseUrl: "http://127.0.0.1:7313",
      fetch: async (request) => app.fetch(request),
    });
    const user = { ...DANA, source: "user" as const };
    const fact = (k: number, from: string, lineage: string[]) =>
      ({
        id: id(k),
        class: "semantic",
        scope: "person:dana",
        owner: "person:dana",
        content: `fact ${k}`,
        provenance: {
          kind: "user",
          ref: "r",
          hash: `sha256:${"0".repeat(64)}`,
          actor: "person:dana",
        },
        confidence: 0.9,
        valid_from: from,
        valid_to: null,
        ttl: null,
        grants: [],
        version: 1,
        lineage,
        status: "active",
        store_ref: null,
        schema_version: 1,
      }) as MemoryItem;
    for (const item of [fact(1, "2026-10-01T00:00:00.000Z", []), fact(2, LATER, [id(1)])])
      expect((await workspace.plane.write(user, item, NOW)).event.decision).toBe("allow");
    return { workspace, client, user };
  }

  async function agentClose(preset: "medium" | "medium-trust") {
    const env = await on(preset);
    const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
    await createMcpServer({
      client: env.client,
      actor: DANA,
      now: () => NOW,
      newId: () => id(800),
      supersede: true,
    }).connect(serverSide);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(clientSide);
    const result = await client.callTool({
      name: "memory_supersede",
      arguments: { item_id: id(2), accept: [id(1)] },
    });
    return { ...env, result, event: env.workspace.plane.events().at(-1) };
  }

  it("on medium-trust, the agent's close of a user-written fact is denied as a downgrade", async () => {
    const { result, event, workspace } = await agentClose("medium-trust");
    expect(result.isError).toBe(true);
    expect(event).toMatchObject({ op: "write", item_id: id(1), decision: "deny" });
    expect(event?.policy_id).toBe("engram/write/downgrade");
    expect(itemById(workspace.deps.db, id(1))).toMatchObject({ version: 1, valid_to: null });
  });

  it("on medium-trust, the owner's own close as a user is allowed", async () => {
    const { client, user, workspace } = await on("medium-trust");
    const { data } = await client.POST("/api/v1/supersede", {
      body: { actor: user, item_id: id(2), accept: [id(1)] },
    });
    const [applied] = (data as { applied: { event: { decision: string } }[] }).applied;
    expect(applied?.event.decision).toBe("allow");
    expect(itemById(workspace.deps.db, id(1))).toMatchObject({
      version: 2,
      valid_to: LATER,
      provenance: { kind: "user" },
    });
  });

  it("on medium, the agent's close is allowed and the fact becomes model-written", async () => {
    const { result, event, workspace } = await agentClose("medium");
    expect(result.isError).toBeFalsy();
    expect(event).toMatchObject({ op: "write", item_id: id(1), decision: "allow" });
    expect(itemById(workspace.deps.db, id(1))?.provenance).toMatchObject({
      kind: "model",
      actor: "person:dana",
    });
  });
});

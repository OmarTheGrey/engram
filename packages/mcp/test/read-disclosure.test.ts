// Card RD1 over MCP: memory_read and memory_explain, which reach the plane
// through the read and explain routes, show the agent no grant naming
// anyone else and no lineage id it may not read. Core decides (visible.ts).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { DANA, id, NOW, readIdOf, testWorkspace, textOf } from "./helpers.ts";

const SAM = { id: "person:sam", level: "person" as const, memberships: ["person:sam"] };
const EVE = { id: "person:eve", level: "person" as const, memberships: ["person:eve"] };
const UNTIL = "2026-12-31T00:00:00.000Z";
const grant = (to: string) => ({
  to,
  class: "semantic" as const,
  mode: "read" as const,
  expires: UNTIL,
});
/** The first fixture memory, dana's person note, which sam may not read. */
const NOTE = id(100);
const ITEM = id(700);

async function seeded() {
  const ws = await testWorkspace();
  const { event } = await ws.workspace.plane.write(
    { ...DANA, source: "user" },
    {
      id: ITEM,
      class: "semantic",
      scope: "person:dana",
      owner: "person:dana",
      content: "Dana prefers written standups.",
      provenance: {
        kind: "user",
        ref: "fixture",
        hash: `sha256:${"0".repeat(64)}`,
        actor: "person:dana",
      },
      confidence: 0.9,
      valid_from: "2026-10-01T00:00:00.000Z",
      valid_to: null,
      ttl: null,
      grants: [grant(SAM.id), grant(EVE.id)],
      version: 1,
      lineage: [NOTE],
      status: "active",
      store_ref: null,
      schema_version: 1,
    },
    NOW,
  );
  expect(event.decision, event.reason).toBe("allow");
  return ws;
}

async function agent(ws: Awaited<ReturnType<typeof seeded>>, actor: typeof SAM) {
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  await ws.makeServer(actor).connect(serverSide);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientSide);
  return client;
}

describe("MCP shows the agent only what its actor may see (RD1)", () => {
  it("sam's memory_read and memory_explain name no ancestor id and no other grantee", async () => {
    const ws = await seeded();
    const sam = await agent(ws, SAM);
    const read = textOf(
      await sam.callTool({ name: "memory_read", arguments: { query: "standups" } }),
    );
    expect(read).toContain(ITEM);
    const explained = textOf(
      await sam.callTool({ name: "memory_explain", arguments: { read_id: readIdOf(read) } }),
    );
    for (const text of [read, explained]) {
      expect(text).not.toContain(NOTE);
      expect(text).not.toContain(EVE.id);
    }
    expect(JSON.parse(explained)[0].grants_used).toEqual([`grants[0]:${SAM.id}`]);
  });

  it("eve's memory_explain names her grant as the first she is shown", async () => {
    const ws = await seeded();
    const eve = await agent(ws, EVE);
    const read = textOf(
      await eve.callTool({ name: "memory_read", arguments: { query: "standups" } }),
    );
    const explained = textOf(
      await eve.callTool({ name: "memory_explain", arguments: { read_id: readIdOf(read) } }),
    );
    expect(JSON.parse(explained)[0].grants_used).toEqual([`grants[0]:${EVE.id}`]);
    expect(explained).not.toContain(SAM.id);
  });
});

// Card E2.17 over MCP: memory_why_not is listed only when the server is
// launched with `whyNot` (the four tools stay condition C7's otherwise), and
// it gives the launch actor the plane's answer for one item: the stage that
// kept it out of the read its query would make now, or the refusal an
// unknown id gets. It appends no event.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createMcpServer, toolList } from "../src/server.ts";
import { DANA, id, NOW, testWorkspace, textOf } from "./helpers.ts";

async function connect(whyNot: boolean, actor = DANA) {
  const ws = await testWorkspace();
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  await createMcpServer({
    client: ws.client,
    actor,
    now: () => NOW,
    newId: () => id(900),
    ...(whyNot ? { whyNot: true } : {}),
  }).connect(serverSide);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientSide);
  return { ws, client };
}

describe("memory_why_not", () => {
  it("is listed only when asked for, after the others", async () => {
    const off = await (await connect(false)).client.listTools();
    expect(off.tools.map((t) => t.name)).not.toContain("memory_why_not");
    const on = await (await connect(true)).client.listTools();
    expect(on.tools.at(-1)?.name).toBe("memory_why_not");
    expect(toolList().map((t) => t.name)).not.toContain("memory_why_not");
    expect(toolList({ whyNot: true }).map((t) => t.name)).toContain("memory_why_not");
  });

  it("tells the launch actor the stage, and an outsider the unknown id's refusal; no event", async () => {
    const { ws, client } = await connect(true);
    const logged = ws.workspace.plane.events().length;
    const ask = async (args: Record<string, unknown>) =>
      JSON.parse(textOf(await client.callTool({ name: "memory_why_not", arguments: args })));
    expect(await ask({ item_id: id(101), query: "runbook" })).toMatchObject({
      answered: true,
      absent: true,
      stage: "match",
      policy_id: "engram/read/match",
    });
    expect(await ask({ item_id: id(101), query: "freeze" })).toMatchObject({
      answered: true,
      absent: false,
    });
    const outsider = { id: "person:eve", level: "person" as const, memberships: ["person:eve"] };
    const other = (await connect(true, outsider)).client;
    const hidden = JSON.parse(
      textOf(
        await other.callTool({
          name: "memory_why_not",
          arguments: { item_id: id(101), query: "freeze" },
        }),
      ),
    );
    const unknown = JSON.parse(
      textOf(
        await other.callTool({
          name: "memory_why_not",
          arguments: { item_id: id(999), query: "freeze" },
        }),
      ),
    );
    expect(hidden.answered).toBe(false);
    expect(hidden).toEqual({
      ...unknown,
      item_id: id(101),
      reason: unknown.reason.replace(id(999), id(101)),
    });
    expect(ws.workspace.plane.events().length).toBe(logged);
  });
});

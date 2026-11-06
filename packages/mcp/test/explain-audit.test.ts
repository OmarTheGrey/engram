// The explain route's `counts` are audit data for the human inspector (ADR
// 0027 amendments, review finding R4-7): `out_of_reach` counts items outside
// the reader's reach, which decision D5 keeps from the reader. The MCP tools
// speak to a model, so neither memory_read nor memory_explain may carry the
// counts or any trace of the items out of reach, even when such items exist.
import { readCounts } from "@engram/core";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { DANA, id, NOW, readIdOf, testWorkspace, textOf } from "./helpers.ts";

const EVE = { id: "person:eve", level: "person" as const, memberships: ["person:eve"] };

describe("memory_explain carries no audit counts", () => {
  it("shows the model the explanations only, with items out of its reach in the log", async () => {
    const ws = await testWorkspace();
    // Two items dana cannot reach, so the read event counts them out of reach.
    for (const n of [1, 2]) {
      const { event } = await ws.workspace.plane.write(
        { ...EVE, source: "user" },
        {
          id: id(900 + n),
          class: "semantic",
          scope: "person:eve",
          owner: "person:eve",
          content: `Eve's private note ${n}.`,
          provenance: {
            kind: "user",
            ref: "fixture",
            hash: `sha256:${"0".repeat(64)}`,
            actor: "person:eve",
          },
          confidence: 0.9,
          valid_from: "2026-10-01T00:00:00.000Z",
          valid_to: null,
          ttl: null,
          grants: [],
          version: 1,
          lineage: [],
          status: "active",
          store_ref: null,
          schema_version: 1,
        },
        NOW,
      );
      expect(event.decision).toBe("allow");
    }
    const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
    await ws.makeServer(DANA).connect(serverSide);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(clientSide);

    const read = textOf(
      await client.callTool({ name: "memory_read", arguments: { query: "the" } }),
    );
    const readId = readIdOf(read);
    const event = ws.workspace.plane.events().find((e) => e.id === readId);
    expect(event && readCounts(event)?.out_of_reach).toBe(2);
    // The same read through the HTTP route does carry the counts, for the inspector.
    const route = await ws.client.POST("/api/v1/explain/{readId}", {
      params: { path: { readId } },
      body: { actor: DANA },
    });
    expect(route.data?.counts?.out_of_reach).toBe(2);

    const explained = textOf(
      await client.callTool({ name: "memory_explain", arguments: { read_id: readId } }),
    );
    for (const text of [read, explained]) {
      expect(text).not.toMatch(/out_of_reach|outside the reader's reach|counts|candidates/);
      expect(text).not.toContain("Eve's private note");
    }
    expect(Array.isArray(JSON.parse(explained))).toBe(true);
  });
});

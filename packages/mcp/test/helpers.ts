// A workspace for the MCP tests: an in-memory log over the fake store, the
// medium preset, ids from a counter, a fixed clock, and the generated client
// bound to the app in process. Three fixture memories are written into
// person:dana as dana herself (source user), so a read has something to
// return and explain.
import { createFakeAdapter } from "@engram/adapters";
import { type Actor, loadPreset, migrate, openSqlite } from "@engram/core";
import { createEngramClient } from "@engram/sdk";
import { createApp, workspaceOf } from "@engram/server";
import { createMcpServer } from "../src/server.ts";

export const NOW = "2026-10-29T12:00:00.000Z";
export const id = (n: number) => `01940000-0000-7000-8000-${String(n).padStart(12, "0")}`;
export const DANA: Actor = { id: "person:dana", level: "person", memberships: ["person:dana"] };

export const FIXTURE = [
  "Dana reviews pull requests in the morning.",
  "The release freeze starts on Friday.",
  "The runbook lives in docs/runbook.md.",
];

export async function testWorkspace() {
  const db = openSqlite(":memory:");
  migrate(db);
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
  for (const [i, content] of FIXTURE.entries())
    await workspace.plane.write(
      { ...DANA, source: "user" },
      {
        id: id(100 + i),
        class: "semantic",
        scope: "person:dana",
        owner: "person:dana",
        content,
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
        grants: [],
        version: 1,
        lineage: [],
        status: "active",
        store_ref: null,
        schema_version: 1,
      },
      NOW,
    );
  const makeServer = (actor: Actor = DANA) =>
    createMcpServer({ client, actor, now: () => NOW, newId });
  return { db, workspace, app, client, makeServer };
}

/** The read id in a memory_read result's tag. */
export const readIdOf = (text: string) => /read_id="([^"]+)"/.exec(text)?.[1] ?? "";

/** The text of a tool result. */
export const textOf = (result: unknown) =>
  ((result as { content: { type: string; text: string }[] }).content[0]?.text ?? "") as string;

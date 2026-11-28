// Card E8.16 over MCP: every tool the server can list (memory_supersede
// included, which is off by default) is called as each probe actor of the
// canary workspace (packages/server/test/leakage-kit.ts), and no tool result
// carries a canary its actor may not see; a denied id and a never-held id
// answer alike but for the pinned characterisation; and a tool with no probe
// and no listed exemption fails the suite. The tools reach the plane through
// the generated client over the HTTP app in process, as `engram mcp` does.
// Structure after ClickHouse/loom's cross-principal leakage suite (see the
// kit's header and docs/absorbed.md).
import { createFakeAdapter } from "@engram/adapters";
import { type Actor, loadPreset, migrate, openSqlite } from "@engram/core";
import { createEngramClient } from "@engram/sdk";
import { createApp, workspaceOf } from "@engram/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import {
  CANARIES,
  CONTROL,
  leaksIn,
  MISSING_ID,
  MISSING_READ,
  NOW,
  noncesIn,
  type OracleRecord,
  PROBE_ACTORS,
  type ProbeActor,
  type ProbeRecord,
  recordProbes,
  seedCanaries,
} from "../../server/test/leakage-kit.ts";
import { createMcpServer, toolList } from "../src/server.ts";
import { readIdOf, textOf } from "./helpers.ts";

const eventId = (n: number) => `01960000-0000-7000-8000-${String(n).padStart(12, "0")}`;

/** The canary workspace over the fake store, and an MCP client for `actor` on it. */
async function served() {
  const db = openSqlite(":memory:");
  migrate(db);
  const adapter = createFakeAdapter();
  const policy = loadPreset("medium");
  let n = 0;
  const newId = () => eventId(++n);
  const seeded = await seedCanaries({ db, adapter, policy, newId });
  const workspace = workspaceOf({ db, adapter, policy, newId });
  const app = createApp(workspace, { port: 7313, now: () => NOW });
  const client = createEngramClient({
    baseUrl: "http://127.0.0.1:7313",
    fetch: async (request) => app.fetch(request),
  });
  const agent = async (actor: Actor) => {
    const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
    await createMcpServer({ client, actor, now: () => NOW, newId, supersede: true }).connect(
      serverSide,
    );
    const mcp = new Client({ name: "leakage", version: "0" });
    await mcp.connect(clientSide);
    return async (name: string, args: Record<string, unknown>) =>
      textOf(await mcp.callTool({ name, arguments: args }));
  };
  return { seeded, agent };
}

interface Call {
  args: Record<string, unknown>;
  /** Ids the call names, which a result may echo. */
  asks?: string[];
}

const ids = [...CANARIES.map((c) => c.id), MISSING_ID];
const SCOPES = ["person:dana", "team:x", "person:fred"];

/** The calls of each tool: data, so a new tool needs one line here or in EXEMPT. */
const PROBES: Record<string, (ctx: { actor: Actor; danaReadId: string }) => Call[]> = {
  memory_write: ({ actor }) =>
    [...SCOPES, actor.memberships[0] as string].map((scope) => ({
      args: { scope, content: `a probe's note in ${scope}` },
    })),
  memory_read: () => [
    { args: { query: "canary" } },
    ...CANARIES.map((c) => ({ args: { query: c.nonce } })),
  ],
  memory_explain: ({ danaReadId }) =>
    [danaReadId, MISSING_READ].map((id) => ({ args: { read_id: id }, asks: [id] })),
  memory_simulate: () => [{ args: {} }, { args: { candidate: "permissive" } }],
  memory_supersede: () =>
    ids.flatMap((id) => [
      { args: { item_id: id }, asks: [id] },
      { args: { item_id: id, accept: [id] }, asks: [id] },
    ]),
};

/** Tools no probe calls, each with its reason; none so far. */
const EXEMPT: Record<string, string> = {};

const records: ProbeRecord[] = [];
const oracles: OracleRecord[] = [];
const controls: { surface: string; found: string[] }[] = [];

describe("E8.16: no MCP tool leaks a canary", () => {
  it("every tool the server can list has a probe or a listed exemption, and no entry is stale", () => {
    const names = toolList(true).map((t) => t.name);
    expect(names.filter((n) => !(n in PROBES) && !(n in EXEMPT))).toEqual([]);
    expect(
      [...Object.keys(PROBES), ...Object.keys(EXEMPT)].filter((n) => !names.includes(n)),
    ).toEqual([]);
  });

  for (const probe of PROBE_ACTORS)
    it(`${probe.name} (${probe.actor.id}) is shown no canary it may not see, by any tool`, async () => {
      const { seeded, agent } = await served();
      const call = await agent(probe.actor);
      const asked = new Set<string>();
      const leaks: string[] = [];
      const scan = (tool: string, text: string, p: ProbeActor) => {
        const leaked = leaksIn(text, p, [...asked]);
        records.push({ surface: "mcp", probe: tool, actor: p.name, leaked });
        if (leaked.length > 0) leaks.push(`${tool}: ${leaked.join(", ")}: ${text}`);
      };
      for (const t of toolList(true)) {
        for (const c of PROBES[t.name]?.({ actor: probe.actor, danaReadId: seeded.danaReadId }) ??
          []) {
          for (const id of c.asks ?? []) asked.add(id);
          const text = await call(t.name, c.args);
          scan(t.name, text, probe);
          // The actor's own read, explained: its explanations are its own.
          if (t.name === "memory_read" && c.args.query === "canary") {
            const own = readIdOf(text);
            scan("memory_explain", await call("memory_explain", { read_id: own }), probe);
          }
        }
      }
      expect(leaks).toEqual([]);
    });

  it("the positive control: a member of team:x is shown the team's canaries", async () => {
    const { agent } = await served();
    const text = await (await agent(CONTROL.actor))("memory_read", { query: "canary" });
    const found = noncesIn(text);
    controls.push({ surface: "mcp", found });
    expect(found).toEqual(expect.arrayContaining(["dana-team", "fred-team", "lee-team"]));
    expect(leaksIn(text, CONTROL)).toEqual([]);
  });

  it("a denied id and a never-held id answer alike, but for the pinned characterisation", async () => {
    const actor = PROBE_ACTORS[0]?.actor as Actor;
    const hidden = CANARIES[0]?.id as string;
    const answer = async (
      tool: string,
      args: (id: string) => Record<string, unknown>,
      id: string,
    ) => {
      const { agent } = await served();
      return (await (await agent(actor))(tool, args(id))).replaceAll(id, "<asked>");
    };
    const { seeded } = await served();
    const pairs: [string, (id: string) => Record<string, unknown>, string, string][] = [
      ["memory_supersede", (id) => ({ item_id: id }), hidden, MISSING_ID],
      ["memory_supersede", (id) => ({ item_id: id, accept: [id] }), hidden, MISSING_ID],
      ["memory_explain", (id) => ({ read_id: id }), seeded.danaReadId, MISSING_READ],
    ];
    const differs: string[] = [];
    for (const [tool, args, denied, missing] of pairs) {
      const left = await answer(tool, args, denied);
      const right = await answer(tool, args, missing);
      oracles.push({ surface: "mcp", probe: tool, alike: left === right });
      if (left !== right) differs.push(`${tool}: ${left} | ${right}`);
    }
    // Decision D5, as over HTTP: another actor's read is refused as made by
    // another actor, an unknown read id as naming no read (pinned in
    // packages/server/test/leakage.test.ts, ORACLES.explain).
    expect(differs).toEqual([
      "memory_explain: explain: read <asked> was made by another actor; only its reader may explain it | explain: <asked> names no read event",
    ]);
  });

  it("writes its probe records when ENGRAM_LEAKAGE_OUT names a folder", () => {
    recordProbes({ suite: "mcp", probes: records, oracles, parity: [], controls });
    expect(records.length).toBeGreaterThan(0);
  });
});

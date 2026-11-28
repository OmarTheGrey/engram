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
import { describe, expect, it } from "vitest";
import {
  byLabel,
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
import { toolList } from "../src/server.ts";
import { readIdOf } from "./helpers.ts";
import { mcpAgent } from "./leakage-agent.ts";

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
  const agent = (actor: Actor) => mcpAgent({ client, actor, now: () => NOW, newId });
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

/** `text` with the asked id and every other id made position-blind. */
function blind(text: string, asked: string): string {
  const seen = new Map<string, string>();
  return text
    .replaceAll(asked, "<asked>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/g, (u) => {
      if (!seen.has(u)) seen.set(u, `<id${seen.size}>`);
      return seen.get(u) as string;
    });
}

/**
 * Every probe of every tool as `probe`, as over HTTP in three passes: the
 * calls naming no id first, so none may show a canary id; then each naming
 * call, which may echo its own ids; then the first again (memory_simulate
 * replays the session's own calls), never a nonce. Every content block of
 * each result is scanned. Every tool must be called and must answer at least
 * once with something other than an invalid-arguments refusal.
 */
async function probeAll(probe: ProbeActor) {
  const { seeded, agent } = await served();
  const call = await agent(probe.actor);
  const leaks: string[] = [];
  const texts = new Map<string, string[]>();
  const scan = (tool: string, text: string, echo: readonly string[]) => {
    texts.set(tool, [...(texts.get(tool) ?? []), text]);
    const leaked = leaksIn(text, probe, echo);
    records.push({ surface: "mcp", probe: tool, actor: probe.name, leaked });
    if (leaked.length > 0) leaks.push(`${tool}: ${leaked.join(", ")}: ${text}`);
  };
  const all = toolList(true).flatMap((t) =>
    (PROBES[t.name]?.({ actor: probe.actor, danaReadId: seeded.danaReadId }) ?? []).map((c) => ({
      tool: t.name,
      c,
    })),
  );
  const naming = all.filter((p) => (p.c.asks ?? []).length > 0);
  const plain = all.filter((p) => (p.c.asks ?? []).length === 0);
  const asked = naming.flatMap((p) => p.c.asks ?? []);
  const passes = [
    { calls: plain, echo: (_: Call) => [] as string[] },
    { calls: naming, echo: (c: Call) => c.asks ?? [] },
    { calls: plain, echo: (_: Call) => asked },
  ];
  const reached = new Set<string>();
  for (const { calls, echo } of passes)
    for (const { tool, c } of calls) {
      const text = await call(tool, c.args);
      if (!text.startsWith(`${tool}: invalid arguments`)) reached.add(tool);
      scan(tool, text, echo(c));
      // The actor's own read, explained: its explanations are its own.
      if (tool === "memory_read" && c.args.query === "canary")
        scan(
          "memory_explain (own read)",
          await call("memory_explain", { read_id: readIdOf(text) }),
          echo(c),
        );
    }
  const tools = toolList(true).map((t) => t.name);
  expect(
    tools.filter((t) => !texts.has(t)),
    "tools never called",
  ).toEqual([]);
  expect(
    tools.filter((t) => !reached.has(t)),
    "tools that only refused their arguments",
  ).toEqual([]);
  return { leaks, texts };
}

describe("E8.16: no MCP tool leaks a canary", () => {
  it("every tool the server can list has a probe or a listed exemption, and no entry is stale", () => {
    const names: string[] = toolList(true).map((t) => t.name);
    expect(names.filter((n) => !(n in PROBES) && !(n in EXEMPT))).toEqual([]);
    expect(
      [...Object.keys(PROBES), ...Object.keys(EXEMPT)].filter((n) => !names.includes(n)),
    ).toEqual([]);
  });

  for (const probe of PROBE_ACTORS)
    it(`${probe.name} (${probe.actor.id}) is shown no canary it may not see, by any tool`, async () => {
      expect((await probeAll(probe)).leaks).toEqual([]);
    });

  it("the positive control: through memory_read and memory_explain a member of team:x is shown the team's canaries", async () => {
    const { leaks, texts } = await probeAll(CONTROL);
    expect(leaks).toEqual([]);
    const read = (texts.get("memory_read") ?? []).join("\n");
    expect(noncesIn(read)).toEqual(expect.arrayContaining(["dana-team", "fred-team", "lee-team"]));
    // The explanations name items by id: the team's are there.
    const explained = (texts.get("memory_explain (own read)") ?? []).join("\n");
    for (const label of ["dana-team", "fred-team", "lee-team"])
      expect(explained, label).toContain(byLabel(label).id);
    controls.push({ surface: "mcp", found: noncesIn(read) });
  });

  it("a denied id and a never-held id answer alike, for every probe actor and hidden id, but for the pinned characterisation", async () => {
    const { seeded } = await served();
    const differs: string[] = [];
    const pairs: [string, (id: string) => Record<string, unknown>][] = [
      ["memory_supersede", (id) => ({ item_id: id })],
      ["memory_supersede", (id) => ({ item_id: id, accept: [id] })],
    ];
    for (const probe of PROBE_ACTORS) {
      const hidden = CANARIES.filter((c) => !probe.allowed.includes(c.label));
      for (const [tool, args] of pairs) {
        const call = await (await served()).agent(probe.actor);
        const missing = blind(
          await (await (await served()).agent(probe.actor))(tool, args(MISSING_ID)),
          MISSING_ID,
        );
        for (const c of hidden) {
          const denied = blind(await call(tool, args(c.id)), c.id);
          const key = `${tool} ${JSON.stringify(Object.keys(args(c.id)))} ${probe.name} ${c.label}`;
          oracles.push({ surface: "mcp", probe: key, alike: denied === missing });
          if (denied !== missing) differs.push(`${key}: ${denied} | ${missing}`);
        }
      }
      const explain = async (id: string) =>
        blind(
          await (await (await served()).agent(probe.actor))("memory_explain", { read_id: id }),
          id,
        );
      const left = await explain(seeded.danaReadId);
      const right = await explain(MISSING_READ);
      oracles.push({
        surface: "mcp",
        probe: `memory_explain ${probe.name}`,
        alike: left === right,
      });
      if (left !== right) differs.push(`memory_explain ${probe.name}: ${left} | ${right}`);
    }
    // Decision D5, as over HTTP: another actor's read is refused as made by
    // another actor, an unknown read id as naming no read (pinned in
    // packages/server/test/leakage.test.ts, EXPECTED_ORACLES).
    expect(differs).toEqual(
      PROBE_ACTORS.map(
        (p) =>
          `memory_explain ${p.name}: explain: read <asked> was made by another actor; only its reader may explain it | explain: <asked> names no read event`,
      ),
    );
  });

  it("writes its probe records when ENGRAM_LEAKAGE_OUT names a folder", () => {
    recordProbes({ suite: "mcp", probes: records, oracles, parity: [], controls });
    expect(records.length).toBeGreaterThan(0);
  });
});

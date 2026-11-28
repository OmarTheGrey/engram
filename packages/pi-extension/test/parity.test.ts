// Card E8.16 over the pi extension, in a real pi SDK session with the
// scripted model, on the canary workspace of
// packages/server/test/leakage-kit.ts over the files store.
//
// Parity. A model's operations (MODEL_OPS) are made by the agent through
// the extension's tools, in order, and what each answered (the tagged recall
// the model is shown, for a read) and what each logged are matched against
// the file snapshot MODEL_PARITY, which MCP's run beside the HTTP API in
// packages/cli/test/parity.test.ts matches too: the same decisions, reasons,
// rule ids and events through both surfaces.
//
// Leakage. Each probe actor's agent calls every tool the extension
// registers, after a recall at the start of the prompt, and nothing the
// model was sent and nothing the session records carries a canary its actor
// may not see. A registered tool with no probe and no listed exemption fails.
// Parity in the manner of plur-ai/plur's tests (commit 7c6aa73ba14e,
// Apache-2.0; idea only); the leak structure after ClickHouse/loom (see the
// kit's header and docs/absorbed.md).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, SessionManager } from "@earendil-works/pi-coding-agent";
import { createFakeAdapter, createFilesAdapter } from "@engram/adapters";
import { type Actor, loadPreset, migrate, openSqlite } from "@engram/core";
import type { ScriptStep } from "@engram/runner";

/** A scripted tool call's arguments, as the scripted model takes them. */
type ToolArguments = Extract<ScriptStep, { toolCall: unknown }>["toolCall"]["arguments"];

import { afterAll, describe, expect, it } from "vitest";
import {
  CONTROL,
  DANA,
  leaksIn,
  MISSING_READ,
  MODEL_OPS,
  MODEL_PARITY,
  NOW,
  noncesIn,
  opRecord,
  type ParityRecord,
  PROBE_ACTORS,
  type ProbeActor,
  type ProbeRecord,
  recordProbes,
  type Seeded,
  seedCanaries,
} from "../../server/test/leakage-kit.ts";
import { createEngramExtension } from "../src/extension.ts";
import { type RecallDetails, tagRecall } from "../src/index.ts";
import { sentToModel, startSession } from "./harness.ts";

const policy = loadPreset("medium");
/** The files stores' folders, removed after the file. */
const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});
const seedId = (n: number) => `01960000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const runId = (n: number) => `01950000-0000-7000-8000-${String(n).padStart(12, "0")}`;

/**
 * The canary workspace, and an extension acting as `actor` on it. Over the
 * files store, as the CLI's parity suite runs MCP: a read's ties are ranked
 * in the store's own search order, so the snapshot holds for one store.
 */
async function seeded(actor: Actor, recall: boolean) {
  const db = openSqlite(":memory:");
  migrate(db);
  const root = mkdtempSync(join(tmpdir(), "engram-e816-"));
  roots.push(root);
  const adapter = createFilesAdapter({ root, owner: "dana" });
  let n = 0;
  const seed: Seeded = await seedCanaries({ db, adapter, policy, newId: () => seedId(++n) });
  let m = 0;
  const extension = createEngramExtension({
    db,
    adapter,
    policy,
    actor,
    newId: () => runId(++m),
    now: () => NOW,
    recall,
  });
  return { seed, extension };
}

const TOOLS = ["memory_write", "memory_read", "memory_explain", "memory_simulate"];

/** A tool call step whose arguments are read when the model makes it, after the calls before it ran. */
const lazyCall = (id: string, name: string, args: () => Record<string, unknown>): ScriptStep =>
  ({
    toolCall: {
      id,
      name,
      get arguments() {
        return args();
      },
    },
  }) as ScriptStep;

/** Each tool call's result message and the engram.event entries logged while it ran, by call id. */
function byCall(sessionManager: SessionManager) {
  const out = new Map<string, { message: unknown; events: Record<string, unknown>[] }>();
  let buffer: Record<string, unknown>[] = [];
  for (const e of sessionManager.getEntries()) {
    if (e.type === "message" && e.message.role === "assistant") buffer = [];
    if (e.type === "custom" && e.customType === "engram.event")
      buffer.push(e.data as Record<string, unknown>);
    if (e.type === "message" && e.message.role === "toolResult") {
      out.set(e.message.toolCallId, { message: e.message, events: buffer });
      buffer = [];
    }
  }
  return out;
}

/** The read id a memory_read call's result details carry. */
function readIdOf(sessionManager: SessionManager, callId: string): string {
  const read = byCall(sessionManager).get(callId);
  if (read === undefined) throw new Error(`no result for ${callId} yet`);
  return (read.message as { details: RecallDetails }).details.read_id;
}

const textOf = (message: unknown) =>
  ((message as { content: { type: string; text?: string }[] }).content[0]?.text ?? "") as string;

const parity: ParityRecord[] = [];
const records: ProbeRecord[] = [];
const controls: { surface: string; found: string[] }[] = [];

describe("E8.16: the pi extension makes a model's operations as MCP and the HTTP API do", () => {
  it("each operation's answer and events match the snapshot MCP matches", async () => {
    const { extension } = await seeded(DANA, false);
    let run: Awaited<ReturnType<typeof startSession>> | undefined;
    const readId = () => readIdOf(run?.sessionManager as SessionManager, "op-3");
    const steps: ScriptStep[] = [
      ...MODEL_OPS.map((op, i) =>
        lazyCall(`op-${i}`, op.tool, () =>
          JSON.parse(JSON.stringify(op.args).replaceAll("{read}", i === 4 ? readId() : "")),
        ),
      ),
      { text: "done" },
    ];
    run = await startSession(extension, steps, TOOLS);
    await run.session.prompt("Work with memory.");
    expect(run.scripted.remaining()).toBe(0);
    const calls = byCall(run.sessionManager);
    const seen = new Map<string, string>();
    const out = MODEL_OPS.map((op, i) => {
      const call = calls.get(`op-${i}`);
      if (call === undefined) throw new Error(`no result for ${op.name}`);
      const details = (call.message as { details?: RecallDetails }).details;
      // What the model is shown of a read: the tagged recall the context handler builds.
      const answer =
        op.tool === "memory_read" ? tagRecall(details as RecallDetails) : textOf(call.message);
      return opRecord(op.name, answer, call.events, seen);
    });
    run.session.dispose();
    parity.push(...out.map((o) => ({ surface: "pi", operation: o.name, same: true })));
    await expect(`${JSON.stringify(out, null, 2)}\n`).toMatchFileSnapshot(MODEL_PARITY);
  });
});

/** The calls of each tool, by name: data, so a new tool needs one line here or in EXEMPT. */
const PROBES: Record<string, (danaReadId: string) => Record<string, unknown>[]> = {
  // One query matching every canary: a query naming a nonce would put it in
  // the model's context as the agent's own words.
  memory_read: () => [{ query: "canary" }, { query: "the canary" }],
  memory_explain: (danaReadId) => [{ read_id: danaReadId }, { read_id: MISSING_READ }],
  memory_simulate: () => [{}, { candidate: "permissive" }],
  memory_write: () =>
    ["person:dana", "team:x", "person:fred"].map((scope) => ({
      scope,
      content: `a probe's note in ${scope}`,
    })),
};
/** Tools no probe calls, each with its reason; none so far. */
const EXEMPT: Record<string, string> = {};

/** The tools the extension registers, collected from a recording pi (surface.test.ts's way). */
function registeredTools(): string[] {
  const names: string[] = [];
  const pi = new Proxy(
    {},
    {
      get: (_t, key) =>
        key === "registerTool"
          ? (tool: { name: string }) => names.push(tool.name)
          : () => undefined,
    },
  ) as unknown as ExtensionAPI;
  createEngramExtension({
    db: (() => {
      const db = openSqlite(":memory:");
      migrate(db);
      return db;
    })(),
    adapter: createFakeAdapter(),
    policy,
    actor: DANA,
    now: () => NOW,
  })(pi);
  return names;
}

/** One probe actor's session: a recall on the prompt, then every probe call; what it held and sent. */
async function probeSession(probe: ProbeActor) {
  const { seed, extension } = await seeded(probe.actor, true);
  let i = 0;
  const steps: ScriptStep[] = [];
  const toolOf = new Map<string, string>();
  for (const [tool, make] of Object.entries(PROBES))
    for (const args of make(seed.danaReadId)) {
      toolOf.set(`probe-${i}`, tool);
      steps.push({
        toolCall: { id: `probe-${i++}`, name: tool, arguments: args as ToolArguments },
      });
    }
  toolOf.set(`probe-${i}`, "memory_explain");
  // The agent's own read, explained.
  steps.push(
    lazyCall(`probe-${i++}`, "memory_explain", () => ({
      read_id: readIdOf(run.sessionManager, "probe-0"),
    })),
  );
  steps.push({ text: "done" });
  const run = await startSession(extension, steps, TOOLS);
  await run.session.prompt("What do we know about the canary?");
  expect(run.scripted.remaining()).toBe(0);
  const sent = sentToModel(run.scripted);
  const held = JSON.stringify(run.sessionManager.getEntries());
  // Each call's result and the events it logged, as the session holds them.
  const perCall = [...byCall(run.sessionManager)].map(([id, c]) => ({
    tool: toolOf.get(id) ?? id,
    text: JSON.stringify(c),
  }));
  run.session.dispose();
  expect(perCall).toHaveLength(steps.length - 1);
  return { seed, sent, held, perCall };
}

describe("E8.16: no tool of the pi extension leaks a canary", () => {
  it("every registered tool has a probe or a listed exemption, and no entry is stale", () => {
    const names = registeredTools();
    expect(names.filter((n) => !(n in PROBES) && !(n in EXEMPT))).toEqual([]);
    expect(
      [...Object.keys(PROBES), ...Object.keys(EXEMPT)].filter((n) => !names.includes(n)),
    ).toEqual([]);
  });

  for (const probe of PROBE_ACTORS)
    it(`${probe.name} (${probe.actor.id}): nothing the model was sent or the session holds`, async () => {
      const { seed, sent, held, perCall } = await probeSession(probe);
      // The agent named dana's read id and the missing one itself; its own events may echo them.
      const asked = [seed.danaReadId, MISSING_READ];
      const leakedToModel = leaksIn(sent, probe, asked);
      const leakedToSession = leaksIn(held, probe, asked);
      const leaks: string[] = [];
      for (const c of perCall) {
        const leaked = leaksIn(c.text, probe, asked);
        records.push({ surface: "pi", probe: c.tool, actor: probe.name, leaked });
        if (leaked.length > 0) leaks.push(`${c.tool}: ${leaked.join(", ")}`);
      }
      expect(leaks).toEqual([]);
      records.push({
        surface: "pi",
        probe: "model context",
        actor: probe.name,
        leaked: leakedToModel,
      });
      records.push({ surface: "pi", probe: "session", actor: probe.name, leaked: leakedToSession });
      expect(leakedToModel).toEqual([]);
      expect(leakedToSession).toEqual([]);
    });

  it("the positive control: a member of team:x's model is sent the team's canaries", async () => {
    const { sent } = await probeSession(CONTROL);
    const found = noncesIn(sent);
    controls.push({ surface: "pi", found });
    expect(found).toEqual(expect.arrayContaining(["dana-team", "fred-team", "lee-team"]));
    expect(leaksIn(sent, CONTROL)).toEqual([]);
  });

  it("writes its probe records when ENGRAM_LEAKAGE_OUT names a folder", () => {
    recordProbes({ suite: "pi", probes: records, oracles: [], parity, controls });
    expect(records.length).toBeGreaterThan(0);
  });
});

// Acceptance for card PX1 (Gate A check): the Engram extension runs on the
// real Plane inside a pi SDK session, with the scripted model, the fake store
// and the medium preset. A write the policy forbids is blocked in tool_call
// and the same MemoryEvent is in the Engram log and in the session; an allowed
// write lands in the store; memory_read returns only what the Plane admits,
// with its explanation; memory_explain answers for a read id; store commands
// are blocked as bypass_blocked events in the bash tool and in user_bash.
import type { ToolCall } from "@earendil-works/pi-ai";
import { allEvents, createPlane, loadPreset, type MemoryEvent } from "@engram/core";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  createEngramExtension,
  NO_BYPASS_ID,
  RECALL_MESSAGE,
  type RecallDetails,
} from "../src/index.ts";
import {
  AT,
  freshLog,
  type HarnessRun,
  hostUserBash,
  id,
  LEAD,
  OMAR,
  sessionEvents,
  startSession,
  teamFact,
} from "./harness.ts";

const policy = loadPreset("medium");
const TOOLS = ["memory_write", "memory_read", "memory_explain", "memory_simulate", "bash"];

const call = (callId: string, name: string, args: ToolCall["arguments"]) => ({
  toolCall: { id: callId, name, arguments: args },
});

/** A log and store holding two team facts: one omar may read, one he may not. */
async function seeded() {
  const log = freshLog();
  const seeding = createPlane({ ...log, policy });
  const platform = await seeding.write(
    LEAD,
    teamFact(log.newId(), "team:platform", "deploys happen on Tuesdays"),
    AT,
  );
  const payroll = await seeding.write(
    LEAD,
    teamFact(log.newId(), "team:payroll", "payroll deploys are frozen until November"),
    AT,
  );
  expect([platform.event.decision, payroll.event.decision]).toEqual(["allow", "allow"]);
  return { log, seededEvents: 2 };
}

// Ids are handed out in order: items 1 and 3 and events 2 and 4 are the seed;
// the session's recall read is event 5; call-1 is item 6 (checked and denied
// in tool_call) and event 7; call-2 is checked as item 8 in tool_call and
// committed in execute as item 9 with event 10 (decision D12); call-3's read
// is event 11.
const READ_ID = id(11);

const SCRIPT = [
  call("call-1", "memory_write", { scope: "org", content: "deploy keys rotate monthly" }),
  call("call-2", "memory_write", {
    scope: "person:omar",
    content: "omar deploys from the release branch",
    confidence: 0.6,
  }),
  call("call-3", "memory_read", { query: "deploys" }),
  call("call-4", "memory_explain", { read_id: READ_ID }),
  call("call-5", "memory_simulate", {}),
  call("call-6", "bash", { command: "mem0 add 'deploys happen on Tuesdays'" }),
  { text: "done" },
];

let run: HarnessRun;
let log: ReturnType<typeof freshLog>;
let seededEvents: number;
let userBash: Awaited<ReturnType<typeof hostUserBash>>;

beforeAll(async () => {
  ({ log, seededEvents } = await seeded());
  const extension = createEngramExtension({ ...log, policy, actor: OMAR, now: () => AT });
  run = await startSession(extension, SCRIPT, TOOLS);
  await run.session.prompt("Remember how we ship.");
  userBash = await hostUserBash(run.session, "letta agents list");
});

afterAll(() => run?.session.dispose());

const entries = () => run.sessionManager.getEntries();
const toolResult = (callId: string) => {
  for (const e of entries()) {
    if (e.type === "message" && e.message.role === "toolResult" && e.message.toolCallId === callId)
      return e.message;
  }
  throw new Error(`no tool result for ${callId}`);
};
const resultText = (callId: string) => {
  const first = toolResult(callId).content[0];
  return first?.type === "text" ? first.text : "";
};
/** The recall details a memory tool result carries. */
const detailsOf = (callId: string) => toolResult(callId).details as unknown as RecallDetails;
/** The Engram log without the seed written before the session. */
const sessionLog = () => allEvents(log.db).slice(seededEvents);
const logEvent = (pred: (e: MemoryEvent) => boolean) => {
  const found = sessionLog().filter(pred);
  expect(found).toHaveLength(1);
  return found[0] as MemoryEvent;
};

describe("PX1: the Engram extension on the Plane in a pi SDK session", () => {
  test("the scripted model was called once per step", () => {
    expect(run.scripted.remaining()).toBe(0);
  });

  test("a write the policy forbids is blocked, and the same event is in the log and the session (Gate A)", () => {
    const denied = logEvent((e) => e.op === "write" && e.decision === "deny");
    expect(denied).toMatchObject({
      item_id: id(6),
      actor: OMAR.id,
      scope_to: "org",
      reason:
        "source model is not allowed in org scope; provenance set by the plane: source model, actor person:omar",
      policy_id: "preset.medium/write/org",
      ts: AT,
    });
    const mirrored = sessionEvents(run.sessionManager).filter(
      (e) => (e as MemoryEvent).id === denied.id,
    );
    expect(mirrored).toEqual([denied]);
    expect(toolResult("call-1").isError).toBe(true);
    expect(resultText("call-1")).toContain(denied.reason);
    expect(resultText("call-1")).toContain(denied.policy_id);
  });

  test("the denied item never reaches the store", async () => {
    expect(await log.adapter.read({ adapter: "fake", key: id(6) })).toBeUndefined();
  });

  test("an allowed write lands in the store with its event in both logs", async () => {
    const allowed = logEvent((e) => e.op === "write" && e.decision === "allow");
    expect(allowed).toMatchObject({ item_id: id(9), policy_id: "preset.medium/write/person" });
    const stored = await log.adapter.read({ adapter: "fake", key: id(9) });
    expect(stored).toMatchObject({
      scope: "person:omar",
      content: "omar deploys from the release branch",
      provenance: { kind: "model", actor: OMAR.id, model: "scripted/scripted-1" },
    });
    expect(allowed.item).toEqual(stored);
    expect(toolResult("call-2").isError).toBe(false);
    expect(resultText("call-2")).toBe(`stored ${id(9)} in person:omar as active`);
  });

  test("every event in the Engram log is mirrored into the session, in order, and nothing else", () => {
    expect(sessionEvents(run.sessionManager)).toEqual(sessionLog());
    expect(sessionLog().map((e) => e.op)).toEqual([
      "read",
      "write",
      "write",
      "read",
      "bypass_blocked",
      "bypass_blocked",
    ]);
  });

  test("memory_read returns only what the Plane admits, with the explanation", () => {
    const details = detailsOf("call-3");
    expect(details.read_id).toBe(READ_ID);
    expect(details.items.map((i) => i.scope).sort()).toEqual(["person:omar", "team:platform"]);
    // The payroll fact is out of omar's reach, so it is not even counted (decision D5).
    expect(details.filtered).toBe(0);
    expect(details.explanations.map((e) => e.item_id)).toEqual(details.items.map((i) => i.item_id));
    expect(details.items.map((i) => i.policy_id)).toEqual([
      "preset.medium/read/person",
      "preset.medium/read/person",
    ]);
    expect(resultText("call-3")).not.toContain("payroll");
  });

  test("context tags the read the model receives with each admitting rule", () => {
    const sent = JSON.stringify(run.scripted.seen[3]?.messages ?? []);
    expect(sent).toContain(`<engram:memory read_id=\\"${READ_ID}\\"`);
    expect(sent).toContain('policy_id=\\"preset.medium/read/person\\"');
    expect(sent).not.toContain("payroll");
  });

  test("memory_explain returns the explanation recorded for the read id", () => {
    const read = detailsOf("call-3");
    expect(toolResult("call-4").isError).toBe(false);
    expect(detailsOf("call-4").explanations).toEqual(read.explanations);
  });

  test("memory_simulate replays the session's calls under the session's policy, with zero model calls", () => {
    expect(toolResult("call-5").isError).toBe(false);
    const report = JSON.parse(resultText("call-5"));
    expect(report).toMatchObject({ model_calls: 0, changed: [] });
    expect(report.baseline.policy_id).toBe(policy.id);
    // The session's sweeps, the write, the recall and the read, in order;
    // the write is denied as it was in the session.
    const ops = report.baseline.outcomes.map((o: { op: string }) => o.op);
    expect(ops).toContain("write");
    expect(ops).toContain("read");
  });

  test("a store command in the bash tool is blocked as a bypass_blocked event", () => {
    const [blocked] = sessionLog().filter((e) => e.op === "bypass_blocked");
    expect(blocked).toMatchObject({ decision: "deny", policy_id: NO_BYPASS_ID, actor: OMAR.id });
    expect(blocked?.reason).toMatch(/^mem0 /);
    expect(toolResult("call-6").isError).toBe(true);
    expect(resultText("call-6")).toContain(NO_BYPASS_ID);
  });

  test("a store command in user_bash is blocked as a bypass_blocked event without running", () => {
    const blocked = sessionLog().filter((e) => e.op === "bypass_blocked")[1];
    expect(blocked).toMatchObject({ decision: "deny", policy_id: NO_BYPASS_ID });
    expect(blocked?.reason).toMatch(/^letta /);
    expect(userBash.exitCode).toBe(126);
    expect(userBash.output).toContain(NO_BYPASS_ID);
  });
});

describe("PX1: governed recall in before_agent_start", () => {
  let recall: HarnessRun;
  let recallLog: ReturnType<typeof freshLog>;

  beforeAll(async () => {
    const s = await seeded();
    recallLog = s.log;
    const extension = createEngramExtension({ ...s.log, policy, actor: OMAR, now: () => AT });
    recall = await startSession(extension, [{ text: "ok" }], TOOLS);
    await recall.session.prompt("deploys");
  });

  afterAll(() => recall?.session.dispose());

  test("injects what the Plane admits as a custom message carrying the explanation", () => {
    const message = recall.sessionManager
      .getEntries()
      .find((e) => e.type === "custom_message" && e.customType === RECALL_MESSAGE);
    expect(message).toBeDefined();
    const details = (message as { details: RecallDetails }).details;
    expect(details.items.map((i) => i.scope)).toEqual(["team:platform"]);
    expect(details.filtered).toBe(0);
    expect(details.explanations).toHaveLength(1);
    const [read] = allEvents(recallLog.db).slice(2);
    expect(read).toMatchObject({ op: "read", id: details.read_id });
    expect(sessionEvents(recall.sessionManager)).toEqual([read]);
  });

  test("the model sees the recall tagged, and nothing the Plane filtered", () => {
    const sent = JSON.stringify(recall.scripted.seen[0]?.messages ?? []);
    expect(sent).toContain("deploys happen on Tuesdays");
    expect(sent).toContain('policy_id=\\"preset.medium/read/person\\"');
    expect(sent).not.toContain("payroll");
  });
});

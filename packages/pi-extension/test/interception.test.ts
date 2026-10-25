// The interception points of step-0 task S0.5, now on the real Plane (card
// PX1): inside a real pi SDK session the Engram extension blocks a forbidden
// memory_write in tool_call, tags memory in context, mirrors every MemoryEvent
// as an engram.event custom entry, and blocks store commands in user_bash and
// in the model's bash tool.
//
// The session is the golden fixture fixtures/sessions/s0-interception.jsonl,
// and its decisions and events are fixtures/sessions/s0-interception.expected.json.
// ENGRAM_UPDATE_FIXTURES=1 (set by `make fixtures`) rewrites both; otherwise
// the run must reproduce them exactly, and a missing file fails the test
// rather than being created (finding R7-12).
import { readFileSync, writeFileSync } from "node:fs";
import type { ToolCall } from "@earendil-works/pi-ai";
import { allEvents, loadPreset } from "@engram/core";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createEngramExtension } from "../src/index.ts";
import {
  AT,
  freshLog,
  type HarnessRun,
  hostUserBash,
  normalizedJsonl,
  OMAR,
  sessionEvents,
  startSession,
} from "./harness.ts";

const FIXTURE = new URL("../../../fixtures/sessions/s0-interception.jsonl", import.meta.url);
const EXPECTED = new URL(
  "../../../fixtures/sessions/s0-interception.expected.json",
  import.meta.url,
);
const UPDATE = process.env.ENGRAM_UPDATE_FIXTURES === "1";

const call = (id: string, name: string, args: ToolCall["arguments"]) => ({
  toolCall: { id, name, arguments: args },
});

const SCRIPT = [
  call("call-1", "memory_write", { scope: "org", content: "deploy keys rotate monthly" }),
  call("call-2", "memory_write", { scope: "person:omar", content: "deploys happen on Tuesdays" }),
  call("call-3", "memory_read", { query: "deploys" }),
  call("call-4", "bash", { command: "mem0 add 'deploys happen on Tuesdays'" }),
  { text: "done" },
];
const USER_BASH = "mem0 list";

let run: HarnessRun;
let log: ReturnType<typeof freshLog>;
let userBash: Awaited<ReturnType<typeof hostUserBash>>;

beforeAll(async () => {
  log = freshLog();
  const extension = createEngramExtension({
    ...log,
    policy: loadPreset("medium"),
    actor: OMAR,
    now: () => AT,
  });
  run = await startSession(extension, SCRIPT, ["memory_write", "memory_read", "bash"]);
  await run.session.prompt("Remember how deploys work.");
  userBash = await hostUserBash(run.session, USER_BASH);
});

afterAll(() => run?.session.dispose());

const entries = () => run.sessionManager.getEntries();
const toolResults = () =>
  entries().flatMap((e) =>
    e.type === "message" && e.message.role === "toolResult" ? [e.message] : [],
  );
const toolResult = (id: string) => toolResults().find((m) => m.toolCallId === id);

/** The decisions and events of this run, in the shape of the .expected.json file. */
function observed() {
  const sent = run.scripted.seen[3]?.messages ?? [];
  const read = sent.find((m) => "toolCallId" in m && m.toolCallId === "call-3");
  const first = read && "content" in read && Array.isArray(read.content) ? read.content[0] : null;
  return {
    description:
      "Step-0 task S0.5 on the real Plane (card PX1). One pi SDK session with an in-memory session manager, a scripted model, the fake store, the medium preset and actor person:omar. events lists the data of every custom entry with customType engram.event, in session order; each equals the MemoryEvent in the Engram log.",
    events: sessionEvents(run.sessionManager),
    blocked_tool_calls: toolResults()
      .filter((m) => m.isError)
      .map((m) => m.toolCallId),
    model_saw_tagged: {
      model_call: 4,
      tool_call_id: "call-3",
      text: first && "text" in first ? first.text : null,
    },
    user_bash: { command: USER_BASH, exitCode: userBash.exitCode },
  };
}

describe("S0.5 interception on the Plane, through a pi SDK session", () => {
  test("the scripted model was called once per step", () => {
    expect(run.scripted.remaining()).toBe(0);
    expect(run.scripted.seen).toHaveLength(SCRIPT.length);
  });

  test("tool_call blocks the org-scoped memory_write and the model's mem0 bash call", () => {
    expect(toolResult("call-1")).toMatchObject({ isError: true });
    expect(toolResult("call-2")).toMatchObject({ isError: false });
    expect(toolResult("call-4")).toMatchObject({ isError: true });
  });

  test("the tag is request-local: the session keeps the untagged result", () => {
    expect(toolResult("call-3")).toMatchObject({
      content: [{ type: "text", text: "person:omar: deploys happen on Tuesdays" }],
    });
  });

  test("every engram.event entry is the MemoryEvent in the Engram log", () => {
    expect(sessionEvents(run.sessionManager)).toEqual(allEvents(log.db));
  });

  test("user_bash blocks a store command without running it", () => {
    expect(userBash.exitCode).toBe(126);
    expect(userBash.output).toContain("engram");
  });

  test("the decisions and events match the committed expected file", () => {
    const json = `${JSON.stringify(observed(), null, 2)}\n`;
    if (UPDATE) writeFileSync(EXPECTED, json);
    expect(json).toBe(readFileSync(EXPECTED, "utf8"));
  });

  test("the session matches the committed fixture", () => {
    const jsonl = normalizedJsonl(run.sessionManager, run.cwd);
    if (UPDATE) writeFileSync(FIXTURE, jsonl);
    expect(jsonl).toBe(readFileSync(FIXTURE, "utf8"));
  });
});

// Acceptance for step-0 task S0.5: inside a real pi SDK session the Engram
// extension blocks an org-scoped memory_write in tool_call, tags memory in
// context, appends an engram.event custom entry per decision, and blocks
// store commands in user_bash and in the model's bash tool.
//
// The session is also written to fixtures/sessions/s0-interception.jsonl;
// ENGRAM_UPDATE_FIXTURES=1 (set by `make fixtures`) rewrites it.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { ToolCall } from "@earendil-works/pi-ai";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createEngramExtension, STORE_COMMANDS } from "../src/index.ts";
import { type HarnessRun, hostUserBash, normalizedJsonl, startSession } from "./harness.ts";
import { stubGate } from "./stub-gate.ts";

const FIXTURE = new URL("../../../fixtures/sessions/s0-interception.jsonl", import.meta.url);
const EXPECTED = JSON.parse(
  readFileSync(
    new URL("../../../fixtures/sessions/s0-interception.expected.json", import.meta.url),
    "utf8",
  ),
);

const call = (id: string, name: string, args: ToolCall["arguments"]) => ({
  toolCall: { id, name, arguments: args },
});

const SCRIPT = [
  call("call-1", "memory_write", { scope: "org", content: "deploy keys rotate monthly" }),
  call("call-2", "memory_write", { scope: "team", content: "deploys happen on Tuesdays" }),
  call("call-3", "memory_read", { query: "deploys" }),
  call("call-4", "bash", { command: "mem0 add 'deploys happen on Tuesdays'" }),
  { text: "done" },
];

let run: HarnessRun;
let userBash: Awaited<ReturnType<typeof hostUserBash>>;

beforeAll(async () => {
  const extension = createEngramExtension({ gate: stubGate, storeCommands: STORE_COMMANDS });
  run = await startSession(extension, SCRIPT, ["memory_write", "memory_read", "bash"]);
  await run.session.prompt("Remember how deploys work.");
  userBash = await hostUserBash(run.session, EXPECTED.user_bash.command);
});

afterAll(() => run?.session.dispose());

const entries = () => run.sessionManager.getEntries();
const toolResult = (id: string) =>
  entries().find(
    (e) => e.type === "message" && "toolCallId" in e.message && e.message.toolCallId === id,
  );

describe("S0.5 interception through a pi SDK session", () => {
  test("the scripted model was called once per step", () => {
    expect(run.scripted.remaining()).toBe(0);
    expect(run.scripted.seen).toHaveLength(SCRIPT.length);
  });

  test("tool_call blocks the org-scoped memory_write and the model's mem0 bash call", () => {
    for (const id of EXPECTED.blocked_tool_calls) {
      expect(toolResult(id)).toMatchObject({ message: { isError: true } });
    }
    expect(toolResult("call-2")).toMatchObject({ message: { isError: false } });
  });

  test("context tags the memory read result the model receives", () => {
    const { model_call, tool_call_id, text } = EXPECTED.model_saw_tagged;
    const sent = run.scripted.seen[model_call - 1]?.messages ?? [];
    const read = sent.find((m) => "toolCallId" in m && m.toolCallId === tool_call_id);
    expect(read).toMatchObject({ content: [{ type: "text", text }] });
  });

  test("the tag is request-local: the session keeps the untagged result", () => {
    expect(toolResult("call-3")).toMatchObject({
      message: { content: [{ type: "text", text: "team: deploys happen on Tuesdays" }] },
    });
  });

  test("every decision is an engram.event custom entry", () => {
    const events = entries()
      .filter((e) => e.type === "custom" && e.customType === "engram.event")
      .map((e) => (e.type === "custom" ? e.data : undefined));
    expect(events).toEqual(EXPECTED.events);
  });

  test("user_bash blocks a store command without running it", () => {
    expect(userBash.exitCode).toBe(EXPECTED.user_bash.exitCode);
    expect(userBash.output).toContain("engram");
  });

  test("the session matches the committed fixture", () => {
    const jsonl = normalizedJsonl(run.sessionManager, run.cwd);
    if (process.env.ENGRAM_UPDATE_FIXTURES === "1" || !existsSync(FIXTURE)) {
      writeFileSync(FIXTURE, jsonl);
    }
    expect(jsonl).toBe(readFileSync(FIXTURE, "utf8"));
  });
});

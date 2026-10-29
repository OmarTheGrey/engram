// Retention in a pi session (card E2.4, ADR 0025): a write that takes a
// person scope over its budget evicts the oldest item in the same Plane call,
// the evict event is mirrored into the session, a model write restating the
// evicted content is refused (engram/write/retired-content), and the read
// that follows returns only what is left.
//
// The session is the golden fixture fixtures/sessions/e2-4-eviction.jsonl,
// and its decisions and events are fixtures/sessions/e2-4-eviction.expected.json.
// ENGRAM_UPDATE_FIXTURES=1 (set by `make fixtures`) rewrites both; otherwise
// the run must reproduce them exactly, and a missing file fails the test.
import { readFileSync, writeFileSync } from "node:fs";
import type { ToolCall } from "@earendil-works/pi-ai";
import { allEvents, loadPreset, type MemoryEvent, type Policy } from "@engram/core";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createEngramExtension } from "../src/index.ts";
import {
  AT,
  freshLog,
  type HarnessRun,
  normalizedJsonl,
  OMAR,
  sessionEvents,
  startSession,
  toolResults,
} from "./harness.ts";

const FIXTURE = new URL("../../../fixtures/sessions/e2-4-eviction.jsonl", import.meta.url);
const EXPECTED = new URL("../../../fixtures/sessions/e2-4-eviction.expected.json", import.meta.url);
const UPDATE = process.env.ENGRAM_UPDATE_FIXTURES === "1";

const call = (id: string, name: string, args: ToolCall["arguments"]) => ({
  toolCall: { id, name, arguments: args },
});

/** The medium preset with a person-scope semantic budget of one, evicted by recency. */
function oneSlotPolicy(): Policy {
  const medium = loadPreset("medium");
  return {
    ...medium,
    retention: medium.retention.map((r) =>
      r.scope === "person" && r.class === "semantic" ? { ...r, budget: 1, eviction: "recency" } : r,
    ),
  };
}

const SCRIPT = [
  call("call-1", "memory_write", { scope: "person:omar", content: "deploys happen on Tuesdays" }),
  call("call-2", "memory_write", { scope: "person:omar", content: "deploys happen on Wednesdays" }),
  call("call-3", "memory_write", { scope: "person:omar", content: "Deploys happen on TUESDAYS" }),
  call("call-4", "memory_read", { query: "deploys" }),
  { text: "done" },
];

let run: HarnessRun;
let log: ReturnType<typeof freshLog>;

beforeAll(async () => {
  log = freshLog();
  const extension = createEngramExtension({
    ...log,
    policy: oneSlotPolicy(),
    actor: OMAR,
    now: () => AT,
  });
  run = await startSession(extension, SCRIPT, ["memory_write", "memory_read"]);
  await run.session.prompt("Remember when deploys happen.");
});

afterAll(() => run?.session.dispose());

const events = () => sessionEvents(run.sessionManager) as MemoryEvent[];
const result = (id: string) => toolResults(run.sessionManager, id)[0];

function observed() {
  const read = result("call-4");
  return {
    description:
      "Card E2.4. One pi SDK session with an in-memory session manager, a scripted model, the fake store, the medium preset with a person-scope semantic budget of one (recency) and actor person:omar. The second write evicts the first; the third restates the evicted content and is refused as retired content; the read returns the second only. events lists every engram.event custom entry in session order.",
    events: events(),
    blocked_tool_calls: toolResults(run.sessionManager)
      .filter((m) => m.isError)
      .map((m) => m.toolCallId),
    read_items: (read?.details as { items?: { content: unknown }[] } | undefined)?.items?.map(
      (i) => i.content,
    ),
  };
}

describe("E2.4 retention through a pi SDK session", () => {
  test("the second write evicts the first in its own Plane call, mirrored as an event", () => {
    const evict = events().filter((e) => e.op === "evict");
    expect(evict).toHaveLength(1);
    const [first] = events().filter((e) => e.op === "write" && e.decision === "allow");
    expect(evict[0]).toMatchObject({
      decision: "allow",
      item_id: first?.item_id,
      policy_id: "preset.medium/retention/person/semantic",
    });
    expect(result("call-2")).toMatchObject({ isError: false });
  });

  test("the model restating the evicted content is refused as retired content", () => {
    expect(result("call-3")).toMatchObject({ isError: true });
    const denied = events().filter((e) => e.op === "write" && e.decision === "deny");
    expect(denied.map((e) => e.policy_id)).toEqual(["engram/write/retired-content"]);
  });

  test("the read returns only the item left", () => {
    expect(observed().read_items).toEqual(["deploys happen on Wednesdays"]);
  });

  test("every engram.event entry is the MemoryEvent in the Engram log", () => {
    expect(events()).toEqual(allEvents(log.db));
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

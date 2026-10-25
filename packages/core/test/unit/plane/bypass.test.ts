// Plane.recordBypass (card PX1, ADR 0014): a blocked store command, a store
// path a file tool named, or a memory result the extension did not produce
// is one bypass_blocked event, decided and logged by the Plane, that never
// reaches the store. The reason keeps what was attempted, truncated and with
// secrets removed (finding R7-9), and the call is checked like every other
// Plane call (decision D6).
import { describe, expect, test } from "vitest";
import { InvalidCallError } from "../../../src/actor.ts";
import { currentItems } from "../../../src/events.ts";
import {
  BYPASS_ID,
  BYPASS_PATH_ID,
  BYPASS_RESULT_ID,
  bypassAttempt,
  MAX_ATTEMPT_LENGTH,
} from "../../../src/plane.ts";
import { AT, fresh } from "./helpers.ts";

const agent = { id: "person:omar", level: "person" as const, memberships: ["person:omar"] };

describe("Plane.recordBypass", () => {
  test("appends one bypass_blocked deny event naming the store command", async () => {
    const { plane, adapter, db } = fresh();
    const event = await plane.recordBypass(agent, { command: "mem0 add x", store: "mem0" }, AT);
    expect(plane.events()).toEqual([event]);
    expect(event).toMatchObject({
      op: "bypass_blocked",
      decision: "deny",
      actor: "person:omar",
      item_id: null,
      scope_from: null,
      scope_to: null,
      policy_id: BYPASS_ID,
      ts: AT,
    });
    expect(BYPASS_ID).toBe("engram/bypass/store-command");
    expect(event.reason).toBe(
      "mem0 is a memory store command; use the Engram memory tools; attempted: mem0 add x",
    );
    expect(event.item).toBeUndefined();
    expect(adapter.writes).toBe(0);
    expect(currentItems(db)).toEqual([]);
  });

  test("one event per call, in order", async () => {
    const { plane } = fresh();
    await plane.recordBypass(agent, { command: "mem0 list", store: "mem0" }, AT);
    await plane.recordBypass(agent, { command: "letta agents list", store: "letta" }, AT);
    expect(plane.events().map((e) => [e.seq, e.op, e.reason.split(" ")[0]])).toEqual([
      [0, "bypass_blocked", "mem0"],
      [1, "bypass_blocked", "letta"],
    ]);
  });

  test("the log tells two commands on the same store apart (R7-9)", async () => {
    const { plane } = fresh();
    const del = await plane.recordBypass(
      agent,
      { command: "mem0 delete --all", store: "mem0" },
      AT,
    );
    const list = await plane.recordBypass(agent, { command: "mem0 list", store: "mem0" }, AT);
    expect(del.reason).toContain("attempted: mem0 delete --all");
    expect(list.reason).toContain("attempted: mem0 list");
    expect(del.reason).not.toBe(list.reason);
  });

  test("a store path and a foreign memory result have their own rule and reason", async () => {
    const { plane } = fresh();
    const path = await plane.recordBypass(
      agent,
      { command: "read /srv/memory/a.md", store: "files", route: "path" },
      AT,
    );
    expect(path).toMatchObject({ policy_id: BYPASS_PATH_ID, op: "bypass_blocked" });
    expect(path.reason).toBe(
      "the path is inside the root of store files; use the Engram memory tools; attempted: read /srv/memory/a.md",
    );
    const result = await plane.recordBypass(
      agent,
      { command: "memory_read result call-9", store: "fake", route: "result" },
      AT,
    );
    expect(result).toMatchObject({ policy_id: BYPASS_RESULT_ID, op: "bypass_blocked" });
    expect(result.reason).toBe(
      "a memory tool result the Engram extension did not produce was withheld from the model; attempted: memory_read result call-9",
    );
  });
});

describe("bypassAttempt: what the reason keeps of an attempt", () => {
  test.each([
    ["OPENAI_API_KEY=sk-abc123def456ghi mem0 add x", "OPENAI_API_KEY=<redacted> mem0 add x"],
    ["MEM0_TOKEN='s3cr3t value' mem0 add x", "MEM0_TOKEN=<redacted> mem0 add x"],
    ["mem0 add x --api-key sk-abcdefghijklmnop", "mem0 add x --api-key <redacted>"],
    ["mem0 add x --token=abc", "mem0 add x --token=<redacted>"],
    ["mem0 --password hunter2 list", "mem0 --password <redacted> list"],
    [
      "curl -H 'Authorization: Bearer abc.def.ghi' https://api.mem0.ai",
      "curl -H 'Authorization: Bearer <redacted>' https://api.mem0.ai",
    ],
    ["letta --url https://me:pw@host/x list", "letta --url https://<redacted>@host/x list"],
    ["mem0 add sk-proj-0123456789abcdefABCDEF", "mem0 add <redacted>"],
    ["mem0 add 0123456789abcdef0123456789abcdef01", "mem0 add <redacted>"],
  ])("%s", (command, kept) => {
    expect(bypassAttempt(command)).toBe(kept);
  });

  test("newlines become spaces and a long command is cut with a marker", () => {
    expect(bypassAttempt("mem0 add x\nmem0 list")).toBe("mem0 add x mem0 list");
    const long = `mem0 add ${"word ".repeat(100)}`;
    const kept = bypassAttempt(long);
    expect(kept.length).toBe(MAX_ATTEMPT_LENGTH);
    expect(kept.endsWith("...")).toBe(true);
  });
});

describe("Plane.recordBypass checks the call (decision D6)", () => {
  test.each([
    ["an actor without an id", { level: "person", memberships: [] }, AT],
    ["an actor with an empty id", { id: "", level: "person", memberships: [] }, AT],
    ["a time without a zone", agent, "2026-10-25T12:00:00"],
    ["no time", agent, undefined],
  ])("refuses %s and appends nothing", async (_name, actor, at) => {
    const { plane } = fresh();
    await expect(
      plane.recordBypass(actor as never, { command: "mem0 list", store: "mem0" }, at as never),
    ).rejects.toBeInstanceOf(InvalidCallError);
    expect(plane.events()).toEqual([]);
  });

  test("refuses a bypass without a command or a store", async () => {
    const { plane } = fresh();
    await expect(
      plane.recordBypass(agent, { command: "", store: "mem0" }, AT),
    ).rejects.toBeInstanceOf(InvalidCallError);
    await expect(
      plane.recordBypass(agent, { command: "mem0 list", store: "" }, AT),
    ).rejects.toBeInstanceOf(InvalidCallError);
    await expect(
      plane.recordBypass(agent, { command: "x", store: "mem0", route: "other" as never }, AT),
    ).rejects.toBeInstanceOf(InvalidCallError);
    expect(plane.events()).toEqual([]);
  });
});

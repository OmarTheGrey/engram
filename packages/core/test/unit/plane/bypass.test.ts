// Plane.recordBypass (card PX1, ADR 0014): a blocked store command is one
// bypass_blocked event, decided and logged by the Plane, that never reaches
// the store.
import { describe, expect, test } from "vitest";
import { currentItems } from "../../../src/events.ts";
import { BYPASS_ID } from "../../../src/plane.ts";
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
    expect(event.reason).toBe("mem0 is a memory store command; use the Engram memory tools");
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
});

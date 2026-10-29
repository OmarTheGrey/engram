// Plane.checkWrite (decision D12): the write gate's decision without
// committing it. A harness decides in one place (pi's tool_call) and commits
// in another (the tool's execute); the check must give the decision the
// committed write would give, and touch neither the store nor the log.
import { describe, expect, test } from "vitest";
import { type Actor, InvalidCallError } from "../../../src/plane.ts";
import { SCHEMA_ID, WRITE_MEMBERSHIP_ID, WRITE_VERSION_ID } from "../../../src/policy/evaluate.ts";
import type { MemoryItem } from "../../../src/schema.ts";
import { AT, fresh, item } from "./helpers.ts";

const writer: Actor = {
  id: "person:omar",
  level: "team",
  memberships: ["team:platform", "person:omar", "org"],
};

const cases: [string, MemoryItem, Actor][] = [
  ["an allowed write", item(1), writer],
  ["a forbidden class", item(2, { class: "episodic" }), writer],
  ["a non-member", item(3, { scope: "team:payroll" }), writer],
  ["an org write that needs review", item(4, { scope: "org" }), writer],
  ["a schema failure", { ...item(5), confidence: 7 } as MemoryItem, writer],
  ["a model write the actor's source sets", item(6), { ...writer, source: "model" }],
];

describe("Plane.checkWrite", () => {
  test.each(cases)("%s: the same decision as the committed write", async (_n, it, actor) => {
    const { plane } = fresh();
    const check = await plane.checkWrite(actor, it, AT);
    const { event } = await plane.write(actor, it, AT);
    expect(check).toEqual({
      decision: event.decision,
      reason: event.reason,
      policy_id: event.policy_id,
    });
  });

  test.each(cases)("%s: no store write and no event", async (_n, it, actor) => {
    const { plane, adapter, db } = fresh();
    await plane.checkWrite(actor, it, AT);
    expect(adapter.writes).toBe(0);
    expect(plane.events()).toEqual([]);
    expect(db.prepare("SELECT count(*) AS n FROM items").get()).toEqual({ n: 0 });
  });

  test("sees the projected item: a lower version of a stored id is denied", async () => {
    const { plane } = fresh();
    await plane.write(writer, item(7, { version: 3 }), AT);
    const check = await plane.checkWrite(writer, item(7, { version: 2 }), AT);
    expect(check).toMatchObject({ decision: "deny", policy_id: WRITE_VERSION_ID });
  });

  test("denies with the rule ids the write uses", async () => {
    const { plane } = fresh();
    expect(await plane.checkWrite(writer, item(3, { scope: "team:payroll" }), AT)).toMatchObject({
      decision: "deny",
      policy_id: WRITE_MEMBERSHIP_ID,
    });
    expect(
      await plane.checkWrite(writer, { ...item(5), confidence: 7 } as MemoryItem, AT),
    ).toMatchObject({ decision: "deny", policy_id: SCHEMA_ID });
  });

  test("refuses an invalid actor or time like write does", async () => {
    const { plane } = fresh();
    await expect(plane.checkWrite({ ...writer, id: "" }, item(1), AT)).rejects.toBeInstanceOf(
      InvalidCallError,
    );
    await expect(plane.checkWrite(writer, item(1), "yesterday")).rejects.toBeInstanceOf(
      InvalidCallError,
    );
    expect(plane.events()).toEqual([]);
  });
});

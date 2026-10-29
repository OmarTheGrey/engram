// visibleEvents (plan decision 5, ADR 0027 decision 7): a viewer sees the
// events in its member scopes and the events it made; an event naming no
// scope (a read, a bypass) only its maker sees. Checked here on events the
// real Plane appends; the property over generated events is in
// test/property/visible-events.test.ts.
import { describe, expect, it } from "vitest";
import { UnknownReadError } from "../../src/actor.ts";
import { eventVisibleTo, visibleEvents } from "../../src/visible.ts";
import { AT, fresh, item } from "./plane/helpers.ts";

const omar = {
  id: "person:omar",
  level: "person" as const,
  memberships: ["person:omar", "team:platform"],
};
const sara = { id: "person:sara", level: "person" as const, memberships: ["person:sara"] };
const ali = { id: "person:ali", level: "person" as const, memberships: ["team:platform"] };

async function workload() {
  const w = fresh();
  await w.plane.write({ ...omar, source: "user" }, item(1), AT);
  await w.plane.write(
    { ...sara, source: "user" },
    item(2, { scope: "person:sara", owner: "person:sara" }),
    AT,
  );
  await w.plane.read(sara, { at: AT });
  await w.plane.recordBypass(sara, { command: "mem0 add x", store: "mem0" }, AT);
  return w;
}

describe("visibleEvents", () => {
  it("shows a viewer the events in its member scopes and the events it made", async () => {
    const { plane } = await workload();
    const all = plane.events();
    expect(visibleEvents(omar, all).map((e) => e.op)).toEqual(["write"]);
    expect(visibleEvents(sara, all).map((e) => e.op)).toEqual(["write", "read", "bypass_blocked"]);
  });

  it("shows a member of a scope another actor's write into it", async () => {
    const { plane } = await workload();
    const seen = visibleEvents(ali, plane.events());
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ op: "write", actor: "person:omar", scope_to: "team:platform" });
  });

  it("never shows another actor's read or bypass, which name no scope", async () => {
    const { plane } = await workload();
    const others = visibleEvents(omar, plane.events()).filter((e) => e.actor !== omar.id);
    expect(others).toEqual([]);
  });

  it("shows an event whose source scope is a member scope", () => {
    const event = {
      id: "01920000-0000-7000-8000-000000000001",
      seq: 0,
      ts: AT,
      op: "retire" as const,
      item_id: null,
      actor: "person:sara",
      scope_from: "team:platform",
      scope_to: "org",
      decision: "allow" as const,
      reason: "superseded",
      policy_id: "p",
      schema_version: 0 as const,
    };
    expect(eventVisibleTo(ali, event)).toBe(true);
    expect(eventVisibleTo({ id: "person:x", memberships: ["org"] }, event)).toBe(true);
    expect(eventVisibleTo({ id: "person:x", memberships: ["team:other"] }, event)).toBe(false);
  });

  it("keeps the log's order", async () => {
    const { plane } = await workload();
    const seen = visibleEvents(sara, plane.events()).map((e) => e.seq);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });
});

describe("explain on an id that names no read", () => {
  it("throws UnknownReadError naming the id", async () => {
    const { plane } = await workload();
    const write = plane.events()[0];
    await expect(plane.explain(omar, write?.id ?? "")).rejects.toBeInstanceOf(UnknownReadError);
    await expect(plane.explain(omar, "nope")).rejects.toThrow("nope names no read event");
  });
});

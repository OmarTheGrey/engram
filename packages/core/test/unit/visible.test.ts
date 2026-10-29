// visibleEvents (plan decision 5, ADR 0027 decision 7): a viewer sees the
// events in its member scopes and the events it made; an event naming no
// scope (a read, a bypass) only its maker sees. Checked here on events the
// real Plane appends; the property over generated events is in
// test/property/visible-events.test.ts.
import { describe, expect, it } from "vitest";
import { UnknownReadError } from "../../src/actor.ts";
import { itemById } from "../../src/items.ts";
import type { MemoryItem } from "../../src/schema.ts";
import { eventVisibleTo, visibleEvents } from "../../src/visible.ts";
import { AT, fresh, id, item } from "./plane/helpers.ts";

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

/** The read filter's view of the workload's log now. */
const view = (w: Awaited<ReturnType<typeof workload>>) => ({
  policy: w.policy,
  at: AT,
  current: (id: string) => itemById(w.db, id),
});

describe("visibleEvents", () => {
  it("shows a viewer the events in its member scopes and the events it made", async () => {
    const w = await workload();
    const { plane } = w;
    const all = plane.events();
    expect(visibleEvents(omar, all, view(w)).map((e) => e.op)).toEqual(["write"]);
    expect(visibleEvents(sara, all, view(w)).map((e) => e.op)).toEqual([
      "write",
      "read",
      "bypass_blocked",
    ]);
  });

  it("shows a member of a scope another actor's write into it", async () => {
    const w = await workload();
    const { plane } = w;
    const seen = visibleEvents(ali, plane.events(), view(w));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ op: "write", actor: "person:omar", scope_to: "team:platform" });
  });

  it("never shows another actor's read or bypass, which name no scope", async () => {
    const w = await workload();
    const { plane } = w;
    const others = visibleEvents(omar, plane.events(), view(w)).filter((e) => e.actor !== omar.id);
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
    const w = await workload();
    const { plane } = w;
    const seen = visibleEvents(sara, plane.events(), view(w)).map((e) => e.seq);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });
});

describe("the items events carry (review finding R3-4)", () => {
  it("withholds an item in a scope the read matrix does not let the viewer read, keeping the event", async () => {
    const w = await workload();
    await w.plane.write({ ...omar, source: "user" }, item(3, { scope: "person:omar" }), AT);
    // A team-level reader may read team and org scopes only, whatever it is a member of.
    const teamReader = {
      id: "person:tess",
      level: "team" as const,
      memberships: ["person:omar", "team:platform"],
    };
    const seen = visibleEvents(teamReader, w.plane.events(), view(w));
    const personal = seen.find((e) => e.scope_to === "person:omar");
    expect(personal).toMatchObject({ op: "write", decision: "allow" });
    expect(personal?.item).toBeUndefined();
    expect(seen.find((e) => e.scope_to === "team:platform")?.item?.content).toBe("fact number 1");
  });

  it("withholds the item of an event whose item has since been retired", async () => {
    const w = await workload();
    const at = AT;
    const retired = new Map([
      [id(1), { ...(itemById(w.db, id(1)) as MemoryItem), status: "retired" as const }],
    ]);
    const seen = visibleEvents(ali, w.plane.events(), {
      policy: w.policy,
      at,
      current: (x) => retired.get(x),
    });
    expect(seen[0]?.op).toBe("write");
    expect(seen[0]?.item).toBeUndefined();
  });
});

describe("explain on an id that names no read", () => {
  it("throws UnknownReadError naming the id", async () => {
    const w = await workload();
    const { plane } = w;
    const write = plane.events()[0];
    await expect(plane.explain(omar, write?.id ?? "")).rejects.toBeInstanceOf(UnknownReadError);
    await expect(plane.explain(omar, "nope")).rejects.toThrow("nope names no read event");
  });
});

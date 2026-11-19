// The twin screens (card E9.4) below the browser: on the twin fixture
// workspace (fixtures/workspaces/twin/, under the twin profile) through the
// generated client in process, a grant change from the inspector is one
// update event in the plane's log, which the viewer's timeline then shows,
// and the grantee's lanes follow it; and the view functions that group the
// lanes into person and role scopes and read the add-grant form.
import { describe, expect, it } from "vitest";
import type { Actor, Grant } from "../src/api/index.ts";
import { changeGrants, inspect } from "../src/data.ts";
import {
  EMPTY_DRAFT,
  grantFrom,
  grantLabel,
  grantOutcome,
  type Lane,
  laneGroups,
  scopeKind,
} from "../src/view.ts";
import { twinWorkspace } from "./workspace.ts";

const ids = (n: number[]) => n.map((k) => `01970000-0000-7000-8000-${String(k).padStart(12, "0")}`);
const [ONE, TWO, THREE, FOUR, , SIX] = ids([1, 2, 3, 4, 5, 6]) as string[];
const toSam: Grant = {
  to: "person:sam",
  class: "semantic",
  mode: "read",
  expires: "2026-12-19T00:00:00Z",
};

describe("the twin workspace's lanes", () => {
  it("are the viewer's person scope and its role scope, each holding what the plane's read returned", async () => {
    const { client, viewer } = await twinWorkspace();
    const { lanes, read } = await inspect(client, viewer);
    expect(read.policy).toBe("profile.twin v1");
    const groups = laneGroups(lanes);
    expect(groups.map((g) => [g.key, g.lanes.map((l) => l.scope)])).toEqual([
      ["person", ["person:dana"]],
      ["role", ["role:release-manager"]],
    ]);
    const held = (l: Lane | undefined) => l?.items.map((i) => i.id).sort();
    expect(held(groups[0]?.lanes[0])).toEqual([ONE, TWO, SIX].sort());
    expect(held(groups[1]?.lanes[0])).toEqual([THREE, FOUR].sort());
    expect(groups[0]?.lanes[0]?.items.find((i) => i.id === TWO)?.grants).toEqual([
      { ...toSam, expires: "2026-12-31T00:00:00.000Z" },
    ]);
  });
});

describe("a grant change from the inspector", () => {
  it("is one update event in the log, on the viewer's timeline, and the grantee then reads the item", async () => {
    const { client, viewer, workspace, workload } = await twinWorkspace();
    const sam = workload.actors.sam as Actor;
    const before = workspace.plane.events().length;
    const r = await changeGrants(client, viewer, ONE as string, { add: [toSam] });
    const added = workspace.plane.events().slice(before);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      id: r.event.id,
      op: "update",
      decision: "allow",
      actor: viewer.id,
      item_id: ONE,
      policy_id: "engram/grant/change",
    });
    expect(grantOutcome(ONE as string, r)).toMatchObject({
      decision: "allow",
      policyId: "engram/grant/change",
      eventId: r.event.id,
    });
    const after = await inspect(client, viewer);
    expect(after.events.map((e) => e.id)).toContain(r.event.id);
    const samsLanes = laneGroups((await inspect(client, sam)).lanes);
    const granted = samsLanes.find((g) => g.key === "granted");
    expect(granted?.lanes.map((l) => [l.scope, l.items.map((i) => i.id).sort()])).toEqual([
      ["person:dana", [ONE, TWO].sort()],
    ]);
  });

  it("is asked for as the viewer with source user, which the viewer does not carry", async () => {
    const { client, viewer, workspace } = await twinWorkspace();
    const { source: _s, ...bare } = viewer;
    await changeGrants(client, bare as Actor, ONE as string, { add: [toSam] });
    expect(workspace.plane.events().at(-1)).toMatchObject({ decision: "allow" });
  });

  it("is a deny event the inspector shows, when the plane refuses it", async () => {
    const { client, viewer, workspace } = await twinWorkspace();
    const before = workspace.plane.events().length;
    const model = await changeGrants(client, viewer, SIX as string, { add: [toSam] });
    expect(model.decision).toBe("deny");
    expect(model.event.policy_id).toBe("engram/write/grant");
    const lees = await changeGrants(client, viewer, FOUR as string, { add: [toSam] });
    expect(lees.event.policy_id).toBe("engram/grant/owner");
    expect(
      workspace.plane
        .events()
        .slice(before)
        .map((e) => e.decision),
    ).toEqual(["deny", "deny"]);
  });
});

describe("the view functions", () => {
  it("read a scope's level from its name", () => {
    expect(["person:a", "role:b", "team:c", "org"].map(scopeKind)).toEqual([
      "person",
      "role",
      "team",
      "org",
    ]);
  });

  it("group lanes, always showing the person and role groups", () => {
    const lane = (scope: string, member = true): Lane => ({
      scope,
      kind: scopeKind(scope),
      member,
      items: [],
    });
    expect(laneGroups([lane("person:a")]).map((g) => g.key)).toEqual(["person", "role"]);
    expect(
      laneGroups([
        lane("team:t"),
        lane("role:r"),
        lane("person:a"),
        lane("org"),
        lane("person:b", false),
      ]).map((g) => [g.key, g.lanes.map((l) => l.scope)]),
    ).toEqual([
      ["person", ["person:a"]],
      ["role", ["role:r"]],
      ["shared", ["team:t", "org"]],
      ["granted", ["person:b"]],
    ]);
  });

  it("read the add-grant form, leaving what is acceptable to the plane", () => {
    const draft = { ...EMPTY_DRAFT, to: " person:sam ", expires: "2026-12-19" };
    expect(grantFrom(draft)).toEqual(toSam);
    expect(grantFrom({ ...draft, expires: "2026-12-19T08:30:00.5Z" })).toMatchObject({
      expires: "2026-12-19T08:30:00.5Z",
    });
    // No class and no expiry are left out; the plane refuses such a grant (D4).
    expect(grantFrom({ ...draft, class: "", expires: "" })).toEqual({
      to: "person:sam",
      mode: "read",
    });
    expect(grantFrom({ ...draft, to: "*" })).toMatchObject({ to: "*" });
    expect(grantFrom({ ...draft, to: "" })).toMatch(/names who/);
    expect(grantFrom({ ...draft, expires: "next week" })).toMatch(/UTC date/);
    expect(grantFrom({ ...draft, expires: "2026-12-19T08:30:00+02:00" })).toMatch(/UTC date/);
    expect(grantFrom({ ...draft, class: "secret" })).toMatch(/unknown class/);
    expect(grantFrom({ ...draft, mode: "write" })).toMatch(/unknown mode/);
  });

  it("label a grant with every field", () => {
    expect(grantLabel(toSam)).toBe("person:sam: semantic, read, until 2026-12-19T00:00:00Z");
    expect(grantLabel({ to: "agent:pi", mode: "read_write" })).toBe(
      "agent:pi: any class, read_write, no expiry",
    );
  });
});

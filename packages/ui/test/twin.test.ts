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
  shownGrants,
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

  it("leaves the grants the lanes show unchanged when the plane refuses it (review M4)", async () => {
    const { client, viewer } = await twinWorkspace();
    const shown = async () =>
      (await inspect(client, viewer)).lanes
        .flatMap((l) => l.items)
        .map((i) => [i.id, i.grants] as const);
    const before = await shown();
    const { expires: _e, ...noExpiry } = toSam;
    const refused: [string, Grant][] = [
      [TWO as string, noExpiry],
      [TWO as string, { ...toSam, expires: "2026-11-01T00:00:00Z" }],
      [SIX as string, toSam],
      [FOUR as string, toSam],
    ];
    for (const [target, grant] of refused)
      expect((await changeGrants(client, viewer, target, { add: [grant] })).decision).toBe("deny");
    expect(await shown()).toEqual(before);
  });
});

describe("the grants a viewer is shown (review M2)", () => {
  it("are all of them for the owner, and only the viewer's own for a grantee", async () => {
    const { client, viewer, workload } = await twinWorkspace();
    const toLee: Grant = { ...toSam, to: "person:lee" };
    expect((await changeGrants(client, viewer, TWO as string, { add: [toLee] })).decision).toBe(
      "allow",
    );
    const two = async (who: Actor) =>
      (await inspect(client, who)).lanes.flatMap((l) => l.items).find((i) => i.id === TWO);
    expect(await two(viewer)).toMatchObject({
      grantsShown: "all",
      grants: [expect.objectContaining({ to: "person:sam" }), toLee],
    });
    const sam = workload.actors.sam as Actor;
    const samsView = await two(sam);
    expect(samsView?.grantsShown).toBe("yours");
    expect(samsView?.grants.map((g) => g.to)).toEqual(["person:sam"]);
  });

  // Since card RD1 core narrows the grants (visible.ts); the view shows them
  // as given and only labels them (review finding 5 of RD1).
  it("are core's, shown as given; all only for the owner of an answer that came whole", () => {
    const grants: Grant[] = [{ ...toSam, to: "person:s*" }, toSam];
    const item = { grants, owner: "person:dana" };
    expect(shownGrants(item, "person:sam", true)).toEqual({ grants, grantsShown: "yours" });
    expect(shownGrants(item, "person:dana", true)).toEqual({ grants, grantsShown: "all" });
    expect(shownGrants(item, "person:dana", false)).toEqual({ grants, grantsShown: "yours" });
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

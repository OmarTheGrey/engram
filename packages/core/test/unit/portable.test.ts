// bundleRows (card E9.8, docs/bundle.md): a bundle holds the items in the
// actor's own person scope and the actor's own items in the other scopes it
// may read, of every status, each with the visible events naming it and
// without their item state. Checked on events the real Plane appends.
import { describe, expect, it } from "vitest";
import { currentItems } from "../../src/events.ts";
import { BUNDLE_VERSION, bundleRows, exportable } from "../../src/portable.ts";
import { eventVisibleTo } from "../../src/visible.ts";
import { AT, fresh, id, item, testPolicy } from "./plane/helpers.ts";

const omar = {
  id: "person:omar",
  level: "person" as const,
  memberships: ["person:omar", "team:platform"],
};
const sara = {
  id: "person:sara",
  level: "person" as const,
  memberships: ["person:sara", "team:platform", "person:omar"],
};

async function workload() {
  const w = fresh();
  const user = (a: typeof omar) => ({ ...a, source: "user" as const });
  // omar's own scope: his item, and one sara wrote there as a member.
  await w.plane.write(user(omar), item(1, { scope: "person:omar" }), AT);
  await w.plane.write(
    user(sara),
    item(2, { scope: "person:omar", owner: "person:sara", provenance: undefined as never }),
    AT,
  );
  await w.plane.write(
    user(sara),
    item(3, {
      scope: "person:omar",
      owner: "person:sara",
      provenance: { kind: "user", ref: "doc/3", hash: `sha256:${"0".repeat(64)}`, actor: "x" },
    }),
    AT,
  );
  // team:platform: omar's item and sara's.
  await w.plane.write(user(omar), item(4), AT);
  await w.plane.write(user(sara), item(5, { owner: "person:sara" }), AT);
  // sara's own scope, which omar is no member of.
  await w.plane.write(user(sara), item(6, { scope: "person:sara", owner: "person:sara" }), AT);
  // A second version of item 4 (version 2), then a denied write of item 1.
  await w.plane.write(user(omar), item(4, { version: 2, content: "fact four, revised" }), AT);
  await w.plane.write(user(omar), item(1, { version: 1, owner: "person:sara" }), AT);
  return w;
}

describe("bundleRows", () => {
  it("takes the actor's person scope whole and only its own items elsewhere", async () => {
    const w = await workload();
    const rows = bundleRows(w.policy, omar, currentItems(w.db), w.plane.events());
    expect(rows.map((r) => r.item.id)).toEqual([id(1), id(3), id(4)]);
    // item 2 failed the schema (no provenance) and was never stored.
    expect(rows[2]?.item.content).toBe("fact four, revised");
  });

  it("carries every visible event naming the item, in log order, without its item state", async () => {
    const w = await workload();
    const rows = bundleRows(w.policy, omar, currentItems(w.db), w.plane.events());
    const one = rows[0];
    expect(one?.events.map((e) => [e.op, e.decision])).toEqual([
      ["write", "allow"],
      ["write", "deny"],
    ]);
    const four = rows[2];
    expect(four?.events.map((e) => e.decision)).toEqual(["allow", "allow"]);
    for (const row of rows) for (const e of row.events) expect("item" in e).toBe(false);
    expect(four?.events[0]?.seq).toBeLessThan(four?.events[1]?.seq ?? 0);
  });

  it("follows the read matrix: a level that may not read a scope takes nothing from it", async () => {
    const w = await workload();
    const asTeam = { ...omar, level: "team" as const };
    const rows = bundleRows(w.policy, asTeam, currentItems(w.db), w.plane.events());
    // The test policy lets a team reader read team and org only, not person.
    expect(rows.map((r) => r.item.id)).toEqual([id(4)]);
  });

  it("takes items of every status, so a retired version a lineage names comes along", async () => {
    const w = await workload();
    const retired = { ...item(7, { scope: "person:omar" }), status: "retired" as const };
    expect(exportable(w.policy, omar, retired)).toBe(true);
    expect(exportable(w.policy, omar, { ...retired, scope: "person:sara" })).toBe(false);
    expect(exportable(testPolicy(), omar, { ...retired, scope: "org", owner: "person:sara" })).toBe(
      false,
    );
  });

  it("Plane.export returns the rows and appends one read event only its maker sees", async () => {
    const w = await workload();
    const before = w.plane.events().length;
    const { rows, event } = await w.plane.export(omar, AT);
    expect(rows.map((r) => r.item.id)).toEqual([id(1), id(3), id(4)]);
    expect(w.plane.events()).toHaveLength(before + 1);
    expect(event).toMatchObject({
      op: "read",
      actor: "person:omar",
      item_id: null,
      scope_from: null,
      scope_to: null,
      decision: "allow",
      policy_id: "test/read/person",
    });
    expect(event.reason).toMatch(/^exported 3 items with 5 events as a bundle under test v1/);
    expect(event.item_ids).toBeUndefined();
    expect(eventVisibleTo(omar, event, w.policy)).toBe(true);
    expect(eventVisibleTo(sara, event, w.policy)).toBe(false);
    await expect(w.plane.export({ ...omar, id: "" }, AT)).rejects.toThrow(/invalid actor/);
  });

  it("names its format version", () => {
    expect(BUNDLE_VERSION).toBe(1);
  });
});

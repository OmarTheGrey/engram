// The subject access export (card E9.16): a person's bundle (card E9.8) and
// the closure of the items derived from it in other scopes, named where the
// person may ask for them by id (ADR 0047), counted otherwise. Checked on
// events and items the real Plane wrote.
import { describe, expect, it } from "vitest";
import { currentItems } from "../../src/events.ts";
import {
  bundleRows,
  SUBJECT_ACCESS_FORMAT,
  subjectAccessOf,
  subjectAccessReport,
  subjectClosure,
  subjectRefusal,
} from "../../src/portable.ts";
import { AT, fresh, id, item, testPolicy } from "./plane/helpers.ts";

const omar = {
  id: "person:omar",
  level: "person" as const,
  memberships: ["person:omar", "team:platform"],
};
const sara = {
  id: "person:sara",
  level: "person" as const,
  memberships: ["person:sara", "team:platform", "team:ops"],
};
const user = (a: typeof omar) => ({ ...a, source: "user" as const });
const CANARY = "CANARY-e916-out-of-reach";

/** Omar's items, and sara's items derived from them in scopes omar reads and does not. */
async function workload() {
  const w = fresh();
  await w.plane.write(user(omar), item(1, { scope: "person:omar" }), AT);
  await w.plane.write(user(omar), item(2), AT); // team:platform, omar's own
  // Derived, in a scope omar reads: named.
  await w.plane.write(
    user(sara),
    item(3, { owner: "person:sara", lineage: [id(2)], content: "sara's note on omar's fact" }),
    AT,
  );
  // Derived, in sara's person scope: counted, never named.
  await w.plane.write(
    user(sara),
    item(4, {
      scope: "person:sara",
      owner: "person:sara",
      lineage: [id(1)],
      content: `${CANARY} 4`,
    }),
    AT,
  );
  // Derived from a derived item, in a team omar is no member of: counted.
  await w.plane.write(
    user(sara),
    item(5, { scope: "team:ops", owner: "person:sara", lineage: [id(3)], content: `${CANARY} 5` }),
    AT,
  );
  // Derived from an item omar may not see, in a scope omar reads: named,
  // with the withheld id left out of its `from`.
  await w.plane.write(
    user(sara),
    item(6, { owner: "person:sara", lineage: [id(4)], content: "sara's second note" }),
    AT,
  );
  // Not derived from omar's items at all.
  await w.plane.write(user(sara), item(7, { owner: "person:sara" }), AT);
  return w;
}

const view = (w: Awaited<ReturnType<typeof workload>>) => {
  const items = currentItems(w.db);
  return {
    items,
    view: {
      policy: w.policy,
      at: AT,
      current: (i: string) => items.find((x) => x.id === i),
    },
  };
};

describe("subjectRefusal", () => {
  it("lets a person take their own export and nobody else's", () => {
    expect(subjectRefusal(omar, "person:omar")).toBeUndefined();
    expect(subjectRefusal(sara, "person:omar")).toMatch(/goes only to the subject/);
    expect(subjectRefusal({ ...omar, id: "agent:pi" }, "agent:pi")).toMatch(/a person principal/);
    expect(subjectRefusal(omar, "team:platform")).toMatch(/a person principal/);
  });

  it("takes the export at the person level only", () => {
    expect(subjectRefusal({ ...omar, level: "team" }, "person:omar")).toMatch(/person level/);
    expect(subjectRefusal({ ...omar, level: "org" }, "person:omar")).toMatch(/person level/);
  });
});

describe("subjectClosure", () => {
  it("names a derived item the subject may see and counts the rest, transitively", async () => {
    const w = await workload();
    const { items, view: v } = view(w);
    expect(currentItems(w.db).map((i) => i.id)).toHaveLength(7);
    const closure = subjectClosure(omar, items, [id(1), id(2)], v);
    expect(closure).toEqual({
      shown: [
        { id: id(3), from: [id(2)] },
        { id: id(6), from: [] },
      ],
      withheld: 2,
    });
  });

  it("an empty bundle derives nothing", async () => {
    const w = await workload();
    const { items, view: v } = view(w);
    expect(subjectClosure(omar, items, [], v)).toEqual({ shown: [], withheld: 0 });
  });
});

describe("subjectAccessReport", () => {
  it("counts the bundle and its decisions, and holds nothing of an item out of reach", async () => {
    const w = await workload();
    const rows = bundleRows(w.policy, omar, currentItems(w.db), w.plane.events());
    const report = subjectAccessOf(w.db, w.policy, omar, rows, AT);
    expect(report.format).toBe(SUBJECT_ACCESS_FORMAT);
    expect(report.subject).toBe("person:omar");
    expect(report.items).toEqual({
      total: 2,
      by_status: { active: 2 },
      by_class: { semantic: 2 },
      by_level: { person: 1, team: 1 },
    });
    expect(report.decisions).toEqual({ total: 2, by_op: { write: { allow: 2 } } });
    expect(report.derived.withheld).toBe(2);
    const text = JSON.stringify(report);
    expect(text).not.toContain(CANARY);
    for (const hidden of [id(4), id(5), "team:ops", "person:sara"])
      expect(text).not.toContain(hidden);
    expect(report.notes.join(" ")).toMatch(/not a certification/);
  });

  it("is the same for the same log and time", async () => {
    const a = await workload();
    const b = await workload();
    const of = (w: typeof a) =>
      subjectAccessOf(
        w.db,
        w.policy,
        omar,
        bundleRows(w.policy, omar, currentItems(w.db), w.plane.events()),
        AT,
      );
    expect(JSON.stringify(of(a))).toBe(JSON.stringify(of(b)));
  });

  it("accounts for own items in scopes not read, grants elsewhere and own events, by the by-id rule", async () => {
    const w = await workload();
    const inOps = { ...omar, memberships: [...omar.memberships, "team:ops"] };
    // omar's own item in team:ops, written while a member: not in the bundle he takes without it.
    await w.plane.write(user(inOps), item(8, { scope: "team:ops", content: `${CANARY} 8` }), AT);
    // An episodic write the policy forbids: omar's own denied event on no stored item.
    await w.plane.write(user(omar), item(9, { scope: "person:omar", class: "episodic" }), AT);
    // sara's item in team:ops with a grant to omar: admitted to him by the read filter.
    await w.plane.write(
      user(sara),
      item(10, {
        scope: "team:ops",
        owner: "person:sara",
        grants: [
          { to: "person:omar", class: "semantic", mode: "read", expires: "2027-01-01T00:00:00Z" },
        ],
      }),
      AT,
    );
    const rows = bundleRows(w.policy, omar, currentItems(w.db), w.plane.events());
    const report = subjectAccessOf(w.db, w.policy, omar, rows, AT);
    expect(report.scopes).toEqual({ read: ["person:omar", "team:platform"], not_read: 0 });
    expect(report.owned_elsewhere).toEqual({ shown: [], withheld: 1 });
    expect(report.granted).toEqual({ shown: [id(10)], withheld: 0 });
    expect(report.own_events_elsewhere).toEqual({
      total: 2,
      by_op: { write: { allow: 1, deny: 1 } },
    });
    expect(JSON.stringify(report)).not.toContain(id(8));
    expect(JSON.stringify(report)).not.toContain(`${CANARY} 8`);
    // An export the subject made before is not one of its own events here.
    await w.plane.export(omar, AT);
    expect(subjectAccessOf(w.db, w.policy, omar, rows, AT).own_events_elsewhere.total).toBe(2);
  });

  it("counts the memberships named at a level the matrix does not let the subject read", async () => {
    const w = await workload();
    const { items, view: v } = view(w);
    const policy = testPolicy({
      read: { matrix: [{ reader: "person", may_read: ["person", "team"] }], honour_grants: true },
    });
    const r = subjectAccessReport(
      policy,
      { ...omar, memberships: [...omar.memberships, "role:lead"] },
      [],
      items,
      { ...v, policy },
    );
    expect(r.scopes).toEqual({ read: ["person:omar", "team:platform"], not_read: 1 });
  });

  it("refuses a subject who is not a person", async () => {
    const w = await workload();
    const { items, view: v } = view(w);
    const agent = { id: "agent:pi", level: "person" as const, memberships: ["person:omar"] };
    expect(() => subjectAccessReport(testPolicy(), agent, [], items, v)).toThrow(
      /a person principal/,
    );
  });
});
